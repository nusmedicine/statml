# Widget 70's engine reference: R's NMF 0.28 runs `brunet` — the method
# `extractSignatures` runs — from a fixed start for exactly 200 iterations on a
# synthetic count matrix plus pConstant 0.1, and the result is written beside
# the input so `_lab/mutational-signatures-verify.mjs` § 1 can hold widget
# 41's `updateKL`, with brunet's floor, to it.
#
#   node widgets/_lab/mutational-signatures-reference.mjs <scratch>/ms-ref-in.tsv
#   Rscript widgets/_lab/mutational-signatures-reference.R <scratch>/ms-ref-in.tsv widgets/_lab/mutational-signatures-reference.tsv
#
# The input is the widget's own simulated cohort (nothing TCGA's). NMF was
# installed from CRAN on Kenneth's approval, 2026-09-18. A start is passed as
# an NMF model (`seed = nmfModel(W0, H0)`), and `nmf.stop.iteration(200)`
# replaces brunet's own stopping rule, so both sides run the same count.
suppressPackageStartupMessages(library(NMF))
args <- commandArgs(trailingOnly = TRUE)
if (length(args) != 2) stop("usage: Rscript mutational-signatures-reference.R <in.tsv> <out.tsv>")
d <- read.delim(args[1], colClasses = c("character", "integer", "integer", "numeric"))
block <- function(name) {
  b <- d[d$block == name, ]
  m <- matrix(0, max(b$i), max(b$j))
  m[cbind(b$i, b$j)] <- b$value
  m
}
V <- block("V"); W0 <- block("W0"); H0 <- block("H0")
ITER <- 200
fit <- nmf(V + 0.1, ncol(W0), method = "brunet", seed = nmfModel(W = W0, H = H0), .stop = nmf.stop.iteration(ITER))
stopifnot(niter(fit) == ITER)
W <- basis(fit); H <- coef(fit)
long <- function(name, m) data.frame(block = name, i = rep(seq_len(nrow(m)), ncol(m)), j = rep(seq_len(ncol(m)), each = nrow(m)),
                                     value = sprintf("%.17g", as.vector(m)))
out <- rbind(long("V", V), long("W0", W0), long("H0", H0), long("W", W), long("H", H))
con <- file(args[2], open = "wb")
writeLines(c(sprintf("# NMF %s, method brunet, %d iterations from W0/H0 on V + 0.1; %s", packageVersion("NMF"), ITER, R.version.string),
             "block\ti\tj\tvalue", paste(out$block, out$i, out$j, out$value, sep = "\t")), con, sep = "\n")
close(con)
cat(sprintf("brunet: %d iterations, KL residual %.6f; wrote %d values\n", niter(fit), residuals(fit), nrow(out)))
