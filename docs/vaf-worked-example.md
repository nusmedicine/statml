# A worked example for 01-2, cell 24

Draft prose for the lesson, to sit with **Refining Estimates (Optional)**. Every
number is the widget's own, computed by `widgets/tumor-heterogeneity/model.js`
and reproducible with `node widgets/_lab/vaf-scenarios-measure.mjs`. It is
written for the notebook, so it may name the widget; the widget's own copy never
names the lesson (prd §4).

---

## What one VAF can and cannot tell you

Take a tumour sample and follow it through. **70% of the cells in the sample are
tumour cells**, and **75% of those tumour cells carry the mutation**. The region
is diploid — one copy of each inherited chromosome — and the mutation sits on one
of them. Sequencing covers the position 88 times and returns 24 variant reads:

$$\mathrm{VAF}_{\text{obs}} = \frac{24}{88} = 0.273$$

That single number is everything the sequencing gives you. The question is which
tumour produced it.

### Told nothing

Interpret the reading under the assumptions of the first half of this notebook —
a pure sample, a plain diploid genome. Solving

$$\hat{c} = \frac{\mathrm{VAF}_{\text{obs}} \cdot (p\,C_t + 2(1-p))}{p\,m}$$

at $p = 1$ and $C_t = 2$ gives two candidates, one for each multiplicity a
diploid total allows:

| | implied cancer cell fraction |
|---|---|
| the mutation on 1 of 2 copies | **52%** |
| the mutation on 2 of 2 copies | **26%** |

Neither is 75%. The 30% of cells in the sample that are *normal* contributed
reads to the denominator and none to the numerator; with no purity to divide
out, that dilution has been read as **fewer tumour cells carrying the mutation**.
The sample is perfectly ordinary — the assumption is what got it wrong.

### Told the purity

Divide $p = 0.70$ out and the same reading gives:

| | implied cancer cell fraction |
|---|---|
| the mutation on 1 of 2 copies | **75%** — the sample as built |
| the mutation on 2 of 2 copies | **37%** |

The truth is now among the candidates. It is not alone: the reading is equally
consistent with a cell carrying the mutation on *both* copies in 37% of tumour
cells, and $\mathrm{VAF}$ alone cannot separate the two.

### Told the copy number as well

An allele-specific caller (ASCAT) reports the region as $1+1$: one copy of each
inherited chromosome. A somatic mutation arises on **one** chromosome, so it
cannot be on both — the 37% candidate is not a cell that exists. One candidate
is left, and it is the right one:

| | implied cancer cell fraction |
|---|---|
| the mutation on 1 of 2 copies | **75%** |

So **purity is what a diploid region needs, and the allele-specific copy number
is what takes the survivors down to one.**

## Two things this example is not saying

**The candidates are not "impossible samples".** Every scenario listed is a real
cell. What changes between the three panels is not which tumours exist but which
ones the reading can be *reconciled with*, given what the analysis was told.

**And knowing more does not always mean one answer.** Across every sample the
widget can build, being told both purity and copy number leaves the truth among
the candidates every time — but it leaves *only* the truth in 39% of them, and
two or more candidates in the remaining 61%. That residue is not a failure of
the correction; it is exactly the ambiguity the likelihood in §3 below exists to
weigh.

## Change one number and the error changes character

Set the fraction to 1.00 — a mutation in **every** tumour cell, still at 70%
purity in a diploid region. It reads $\mathrm{VAF}_{\text{exp}} = 0.350$. Told
nothing, the analysis reports **70%**: a mutation present throughout the tumour,
described as being in two cells out of three. Told the purity, it reports
**100%**.

That is the difference between a *clonal* and a *subclonal* call, produced by
nothing but a missing purity estimate. Across every clonal mutation of this kind:

| told | in a diploid region | in an altered region |
|---|---|---|
| nothing | 75.0% called subclonal | 81.3% |
| purity | **0.0%** | 62.5% |
| purity and copy number | **0.0%** | **0.0%** |

Purity settles a diploid region completely and does not settle an altered one —
which is why both corrections are here, and why they are not interchangeable.

*(The sweep weights the five copy-number states equally, so it over-represents
altered regions relative to a real genome; how much the copy-number correction
matters in practice depends on how much of the tumour genome is altered.)*
