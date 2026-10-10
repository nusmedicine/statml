# Slot 101: where does selecting features on the labels before CV inflate the
# score? On the lesson's mRNA and methylation blocks with the subtype labels
# permuted (no signal left), a grid of training sizes n and features kept k,
# the selection outside the folds against inside them; chance BER is 0.75.
# multiomics-measure.R leak found the lesson's own set-up barely affected
# (n = 405, thousands of features pass; at BH <= 0.001 none pass on null labels).
#
#   Rscript multiomics-leak-grid.R [seeds]
# Writes _lab/multiomics-leak-grid.json (untracked). Blocks are the lesson's
# filtered files reused unfiltered-by-label here: the grid permutes labels, so
# the lesson's filter carries no information about them.

suppressPackageStartupMessages({ library(mixOmics); library(jsonlite) })
args <- commandArgs(trailingOnly = TRUE)
nseed <- if (length(args) >= 1) as.integer(args[1]) else 3
here <- dirname(normalizePath(sub("^--file=", "",
  grep("^--file=", commandArgs(FALSE), value = TRUE)[1])))
nbdir <- normalizePath(file.path(here, "../../../jupyterbook/phm5003/notebook/10 - Multi-omics Analysis"))
rd <- function(f) read.delim(file.path(nbdir, f), header = TRUE, row.names = 1,
                             stringsAsFactors = FALSE, check.names = FALSE)
meta <- read.delim(file.path(nbdir, "meta.data.all.tsv"), stringsAsFactors = FALSE)
tr <- meta$SAMPLE_ID[meta$set == "training"]
B <- list(mRNA = t(as.matrix(rd("mrna_data_all.tsv")[, tr])),
          meth = t(as.matrix(rd("meth_data_all.tsv")[, tr])))
LEVELS <- c("CN_HIGH", "CN_LOW", "MSI", "POLE")

anovaP <- function(X, y) {            # samples in rows here
  y <- factor(y); n <- nrow(X); k <- nlevels(y); mu <- colMeans(X); ssb <- 0; ssw <- 0
  for (g in levels(y)) { Xg <- X[y == g, , drop = FALSE]; mg <- colMeans(Xg)
    ssb <- ssb + nrow(Xg) * (mg - mu)^2; ssw <- ssw + colSums(sweep(Xg, 2, mg)^2) }
  pf((ssb / (k - 1)) / (ssw / (n - k)), k - 1, n - k, lower.tail = FALSE)
}
top <- function(rows, y, k) lapply(B, function(X) order(anovaP(X[rows, ], y))[1:k])
design <- matrix(0.1, 2, 2, dimnames = list(names(B), names(B))); diag(design) <- 0
berOf <- function(truth, pred) get.BER(get.confusion_matrix(truth = truth, predicted = pred))

cv <- function(rows, y, k, inside, seed) {
  set.seed(seed); folds <- sample(rep(1:10, length.out = length(rows)))
  F0 <- if (!inside) top(rows, y, k) else NULL
  pred <- character(length(rows))
  for (f in 1:10) {
    a <- rows[folds != f]; b <- rows[folds == f]
    F <- if (inside) top(a, y[folds != f], k) else F0
    X <- setNames(lapply(names(B), function(n) B[[n]][a, F[[n]], drop = FALSE]), names(B))
    kx <- lapply(B, function(.) rep(min(10, k), 2))
    m <- block.splsda(X, factor(y[folds != f], levels = LEVELS), ncomp = 2,
                      keepX = kx, design = design)
    nd <- setNames(lapply(names(B), function(n) B[[n]][b, F[[n]], drop = FALSE]), names(B))
    pred[folds == f] <- suppressWarnings(predict(m, newdata = nd))$WeightedVote$centroids.dist[, 2]
  }
  berOf(y, pred)
}

grid <- list()
for (n in c(60, 120, 405)) for (k in c(10, 50, 500)) for (s in seq_len(nseed)) {
  set.seed(2000 + s)
  rows <- if (n < length(tr)) sample(seq_along(tr), n) else seq_along(tr)
  y <- sample(meta$SUBTYPE[match(tr, meta$SAMPLE_ID)])[rows]   # permuted: no signal
  safe <- function(...) tryCatch(cv(...), error = function(e) NA_real_)
  o <- safe(rows, y, k, FALSE, s); i <- safe(rows, y, k, TRUE, s)
  cat("n", n, "k", k, "seed", s, "outside", round(o, 3), "inside", round(i, 3), "\n")
  grid[[length(grid) + 1]] <- list(n = n, k = k, seed = 2000 + s, outside = o, inside = i)
}
writeLines(toJSON(list(grid = grid, mixOmics = as.character(packageVersion("mixOmics"))),
                  auto_unbox = TRUE, digits = 6, pretty = TRUE),
           file.path(here, "multiomics-leak-grid.json"))
cat("wrote multiomics-leak-grid.json\n")
