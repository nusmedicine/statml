# Widget 70 round 5 (2026-09-26): 01-4 cell 19's `estimateSignatures` rerun on
# the lesson's own matrix, to see whether cell 20's cophenetic plot reproduces
# and how much of its shape is the seed.
#
#   Rscript widgets/_lab/mutational-signatures-rank.R <dir with tnm.tsv> <seed> [cores]
#
# tnm.tsv is what mutational-signatures-nmf.R writes (TCGA-derived, so kept
# out of the repo). This is estimateSignatures' own call (maftools 2.26.0, read
# from the installed source): t(nmf_matrix) + pConstant, then
# NMF::nmfEstimateRank(ranks 2..10, method = "brunet", nrun = 10,
# seed = 123456). Cell 19 sets nTry = 10 and pConstant = 0.1 and leaves nrun
# at maftools' default of 10. Only the seed is varied here.
suppressPackageStartupMessages(library(NMF))
args <- commandArgs(trailingOnly = TRUE)
dir <- args[1]; seed <- as.integer(args[2]); cores <- if (length(args) > 2) args[3] else "1"
x <- read.delim(file.path(dir, "tnm.tsv"), check.names = FALSE, row.names = 1)
mat <- t(as.matrix(x)) + 0.1
t0 <- proc.time()
res <- nmfEstimateRank(mat, 2:10, method = "brunet", nrun = 10, seed = seed, .opt = paste0("vP", cores))
s <- summary(res)
cat(sprintf("seed %d · %d x %d · %.0f s\n", seed, nrow(mat), ncol(mat), (proc.time() - t0)[["elapsed"]]))
print(s[, c("rank", "cophenetic", "dispersion", "residuals", "silhouette.consensus")], row.names = FALSE, digits = 4)
