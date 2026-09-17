# Slot 69 `driver-genes`: a reference table for the widget's port of
# maftools' `oncodrive` scoring, on SYNTHETIC genes, so the repo carries no
# TCGA-derived rows and `npm test` needs neither R nor maftools.
#
#   Rscript widgets/_lab/driver-genes-reference.R widgets/_lab/driver-genes-reference.tsv
#
# Each gene is scored by maftools' own `get_threshold` and `cluster_prot`
# (2.26.0, installed 2026-09-17 on Kenneth's approval). The genes are drawn to
# reach every branch those two functions have: hotspots and single residues,
# residues within 5 of each other that merge, residues below the threshold that
# widen a cluster on either side, a residue below it INSIDE a cluster (scored
# but not added to N), a residue within 5 of two clusters (added to both), tied
# peaks (recycled in row order), thresholds from 2 up, and genes with no residue
# at the threshold (NULL, so not in the table). `_lab/driver-genes-verify.mjs`
# asserts the widget reproduces every row.
suppressPackageStartupMessages({ library(maftools); library(data.table) })
args <- commandArgs(trailingOnly = TRUE)
if (length(args) != 1) stop("usage: Rscript driver-genes-reference.R <out.tsv>")
set.seed(69)

draw_gene <- function(i) {
  L <- sample(c(60, 128, 189, 393, 480, 741, 1068, 1512, 2839), 1)
  n <- sample(c(5, 6, 7, 9, 12, 20, 35, 60, 110, 200, 360), 1)
  kind <- i %% 6
  pos <- integer(0)
  if (kind == 0) {                       # spread: no hotspot at all
    pos <- sample.int(L, n, replace = TRUE)
  } else if (kind == 1) {                # one hotspot and scatter
    h <- sample.int(L, 1)
    k <- rbinom(1, n, runif(1, 0.3, 0.95))
    pos <- c(rep(h, k), sample.int(L, n - k, replace = TRUE))
  } else if (kind == 2) {                # a run of hotspots a few residues apart
    h <- sample.int(max(1, L - 12), 1)
    centres <- h + sort(sample(0:10, sample(2:4, 1)))
    k <- rbinom(1, n, 0.7)
    pos <- c(sample(centres, k, replace = TRUE), sample.int(L, n - k, replace = TRUE))
  } else if (kind == 3) {                # hotspots with near neighbours hit once or twice
    hs <- sample.int(L, sample(1:3, 1))
    k <- rbinom(1, n, 0.6)
    near <- pmin(L, pmax(1, sample(hs, n - k, replace = TRUE) + sample(c(-6:-1, 1:6), n - k, replace = TRUE)))
    pos <- c(sample(hs, k, replace = TRUE), near)
  } else if (kind == 4) {                # two clusters 6 to 10 apart, sharing neighbours
    a <- sample.int(max(1, L - 20), 1); b <- a + sample(6:10, 1)
    k <- rbinom(1, n, 0.5)
    mid <- sample((a + 1):(b - 1), max(1, n %/% 8), replace = TRUE)
    rest <- n - k - length(mid)
    pos <- c(sample(c(a, b), k, replace = TRUE), mid, if (rest > 0) sample.int(L, rest, replace = TRUE) else integer(0))
  } else {                               # tied peaks inside one cluster
    a <- sample.int(max(1, L - 8), 1); b <- a + sample(1:4, 1)
    m <- max(2, n %/% 4)
    rest <- n - 2 * m
    pos <- c(rep(a, m), rep(b, m), if (rest > 0) pmin(L, a + sample(-5:9, rest, replace = TRUE)) else integer(0))
  }
  pos <- pmin(L, pmax(1, as.integer(pos)))
  pos <- sample(pos)                     # arrival order, which decides how ties recycle
  list(L = L, pos = pos)
}

rows <- character(0)
nulls <- 0; ties <- 0
for (i in 1:360) {
  g <- draw_gene(i)
  n <- length(g$pos)
  th <- maftools:::get_threshold(gene_muts = n, gene_length = g$L)
  pd <- data.table(pos = g$pos)
  res <- maftools:::cluster_prot(prot.dat = pd, gene = paste0("g", i), th = th, protLen = g$L)
  if (is.null(res)) {
    nulls <- nulls + 1
    rows <- c(rows, sprintf("g%d\t%d\t%d\t%s\tNA\tNA\tNA\t%s", i, g$L, n, if (is.na(th)) "NA" else th, paste(g$pos, collapse = ",")))
  } else {
    rows <- c(rows, sprintf("g%d\t%d\t%d\t%d\t%d\t%d\t%.17g\t%s", i, g$L, n, th, res$clusters, res$muts_in_clusters, res$clusterScores,
                            paste(g$pos, collapse = ",")))
  }
}
writeLines(c(sprintf("# maftools %s get_threshold and cluster_prot on 360 synthetic genes, set.seed(69); positions in arrival order",
                     as.character(packageVersion("maftools"))),
             "gene\tprotLen\tn\tth\tclusters\tmuts_in_clusters\tclusterScores\tpositions", rows),
           args[1], sep = "\n")
cat(sprintf("wrote %d genes, %d with no cluster\n", length(rows), nulls))
