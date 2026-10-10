# Measurements for the multi-omics arc (slots 99 · 100 · 101), on the lesson's
# own TCGA-UCEC data and saved objects. PHM5003 10's notebooks are the spec:
# every step below copies their code, so a number here is the lesson's number.
#
#   Rscript multiomics-measure.R <stage> [notebook dir]
#
# stage: lesson (05's prediction, the [,2] column) · shared (99) ·
# design (100) · leak (101). The notebook dir defaults to the jupyterbook
# checkout beside this repo. Writes _lab/multiomics-<stage>.json (untracked).

suppressPackageStartupMessages({
  library(mixOmics)
  library(jsonlite)
})

args <- commandArgs(trailingOnly = TRUE)
stage <- if (length(args) >= 1) args[1] else "lesson"
here <- dirname(normalizePath(sub("^--file=", "",
  grep("^--file=", commandArgs(FALSE), value = TRUE)[1])))
nbdir <- if (length(args) >= 2 && nzchar(args[2])) args[2] else
  file.path(here, "../../../jupyterbook/phm5003/notebook/10 - Multi-omics Analysis")
nbdir <- normalizePath(nbdir)
out <- list(stage = stage, mixOmics = as.character(packageVersion("mixOmics")))

rd <- function(f, rows = TRUE) {
  if (rows) read.delim(file.path(nbdir, f), header = TRUE, row.names = 1,
                       stringsAsFactors = FALSE, check.names = FALSE)
  else read.delim(file.path(nbdir, f), header = TRUE,
                  stringsAsFactors = FALSE, check.names = FALSE)
}
LEVELS <- c("CN_HIGH", "CN_LOW", "MSI", "POLE")

# 03 cells 3-8: the lesson's preprocessed blocks and its split.
loadLesson <- function() {
  meta <- rd("meta.data.all.tsv", rows = FALSE)
  mrna <- rd("mrna_data_all.tsv"); meth <- rd("meth_data_all.tsv")
  rppa <- rd("rppa_data_all.tsv")
  tr <- meta[meta$set == "training", ]; te <- meta[meta$set == "testing", ]
  list(meta = meta, tr = tr, te = te,
       X = list(mRNA = t(mrna[, tr$SAMPLE_ID]), meth = t(meth[, tr$SAMPLE_ID]),
                rppa = t(rppa[, tr$SAMPLE_ID])),
       Xte = list(mRNA = t(mrna[, te$SAMPLE_ID]), meth = t(meth[, te$SAMPLE_ID])),
       Y = factor(tr$SUBTYPE, levels = LEVELS, ordered = TRUE),
       Yte = te$SUBTYPE)
}

ber <- function(truth, pred) {
  cm <- get.confusion_matrix(truth = truth, predicted = pred)
  list(BER = get.BER(cm), confusion = unclass(cm),
       callsPOLE = sum(pred == "POLE" & truth != "POLE"))
}

if (stage == "lesson") {
  d <- loadLesson()
  e <- new.env(); load(file.path(nbdir, "diablo.ucec.rds"), envir = e)
  model <- e$diablo.ucec
  out$dims <- lapply(d$X, dim)
  out$train <- as.list(table(d$tr$SUBTYPE)); out$test <- as.list(table(d$te$SUBTYPE))
  p <- suppressWarnings(predict(model, newdata = d$Xte))
  cd <- p$WeightedVote$centroids.dist
  out$centroidsColnames <- colnames(cd)
  out$byColumn <- lapply(seq_len(ncol(cd)), function(k) ber(d$Yte, cd[, k]))
  names(out$byColumn) <- colnames(cd)
  # Does the saved model match a refit from the lesson's own keepX? (6.30 vs 6.34)
  e2 <- new.env(); load(file.path(nbdir, "ucec.list.keepX.rda"), envir = e2)
  design <- matrix(0.1, 3, 3, dimnames = list(names(d$X), names(d$X))); diag(design) <- 0
  refit <- block.splsda(d$X, d$Y, ncomp = 4, keepX = e2$list.keepX, design = design)
  same <- sapply(names(d$X), function(b)
    max(abs(abs(refit$loadings[[b]]) - abs(model$loadings[[b]]))))
  out$refitMaxLoadingDiff <- as.list(same)
  out$keepX <- e2$list.keepX
  # 03 cells 12-13: the PLS correlations the lesson reads as design weights.
  pr <- function(a, b) { r <- pls(d$X[[a]], d$X[[b]], ncomp = 1)
    cor(r$variates$X, r$variates$Y)[1, 1] }
  out$plsCor <- list(mRNA_meth = pr("mRNA", "meth"), mRNA_rppa = pr("mRNA", "rppa"),
                     meth_rppa = pr("meth", "rppa"))
}

# How much of a score's variance the subtype explains (one-way eta squared).
eta2 <- function(s, y) { m <- tapply(s, y, mean); n <- table(y)
  sum(n * (m - mean(s))^2) / sum((s - mean(s))^2) }
# Share of a scaled block's total variance one score direction captures.
varShare <- function(X, w) { Xs <- scale(X); s <- Xs %*% (w / sqrt(sum(w^2)))
  sum(s^2) / sum(Xs^2) }

if (stage == "shared") {
  # 99: PCA within a block against PLS across two, on the lesson's training
  # blocks, scaled as mixOmics scales them by default.
  d <- loadLesson()
  pcs <- lapply(d$X, function(X) prcomp(X, center = TRUE, scale. = TRUE, rank. = 5))
  out$pca <- lapply(names(d$X), function(b) {
    p <- pcs[[b]]; v <- p$sdev^2 / sum(p$sdev^2)
    list(block = b, varPC = v[1:5],
         eta2PC = sapply(1:5, function(k) eta2(p$x[, k], d$Y)))
  })
  pairs <- list(c("mRNA", "meth"), c("mRNA", "rppa"), c("meth", "rppa"))
  out$pairs <- lapply(pairs, function(ab) {
    a <- ab[1]; b <- ab[2]
    r <- pls(d$X[[a]], d$X[[b]], ncomp = 1)
    ta <- r$variates$X[, 1]; tb <- r$variates$Y[, 1]
    pa <- pcs[[a]]$x[, 1]; pb <- pcs[[b]]$x[, 1]
    # The best cross-block correlation any pair of the first five PCs reaches.
    cc <- abs(cor(pcs[[a]]$x[, 1:5], pcs[[b]]$x[, 1:5]))
    list(a = a, b = b,
         corPC1 = abs(cor(pa, pb)), corPLS = abs(cor(ta, tb)),
         bestPCpair = max(cc), bestPCidx = which(cc == max(cc), arr.ind = TRUE)[1, ],
         varPLS = c(varShare(d$X[[a]], r$loadings$X[, 1]),
                    varShare(d$X[[b]], r$loadings$Y[, 1])),
         varPC1 = c(pcs[[a]]$sdev[1]^2 / sum(pcs[[a]]$sdev^2),
                    pcs[[b]]$sdev[1]^2 / sum(pcs[[b]]$sdev^2)),
         cosPC1PLS = c(abs(sum(pcs[[a]]$rotation[, 1] * r$loadings$X[, 1]) /
                             sqrt(sum(r$loadings$X[, 1]^2))),
                       abs(sum(pcs[[b]]$rotation[, 1] * r$loadings$Y[, 1]) /
                             sqrt(sum(r$loadings$Y[, 1]^2)))),
         eta2PLS = c(eta2(ta, d$Y), eta2(tb, d$Y)))
  })
}

if (stage == "design") {
  # 100: the design weight as a choice of objective. One sweep of the weight
  # between the omics blocks, everything else the lesson's (keepX, 4 comps).
  d <- loadLesson()
  e2 <- new.env(); load(file.path(nbdir, "ucec.list.keepX.rda"), envir = e2)
  nrep <- if (length(args) >= 3) as.integer(args[3]) else 3
  ws <- c(0, 0.1, 0.25, 0.5, 0.75, 0.9, 1)
  out$sweep <- lapply(ws, function(w) {
    design <- matrix(w, 3, 3, dimnames = list(names(d$X), names(d$X))); diag(design) <- 0
    m <- block.splsda(d$X, d$Y, ncomp = 4, keepX = e2$list.keepX, design = design)
    V <- sapply(names(d$X), function(b) m$variates[[b]][, 1])
    cm <- abs(cor(V))
    p <- suppressWarnings(predict(m, newdata = d$Xte))
    set.seed(123)
    pf <- perf(m, validation = "Mfold", folds = 10, nrepeat = nrep, progressBar = FALSE)
    cvb <- pf$WeightedVote.error.rate$centroids.dist["Overall.BER", ]
    blockEta <- sapply(names(d$X), function(b)
      sapply(1:4, function(k) eta2(m$variates[[b]][, k], d$Y)))
    cat("w", w, "cor", round(cm[upper.tri(cm)], 3), "cvBER4", round(cvb[4], 3), "\n")
    list(w = w, corComp1 = cm[upper.tri(cm)], corNames = c("mRNA-meth", "mRNA-rppa", "meth-rppa"),
         eta2 = blockEta, cvBER = cvb,
         testBER = sapply(1:4, function(k) ber(d$Yte, p$WeightedVote$centroids.dist[, k])$BER),
         selected = lapply(names(d$X), function(b) selectVar(m, block = b, comp = 1)[[b]]$name))
  })
  # Predict at the lesson's 0.1: each block's own call on the test samples.
  design <- matrix(0.1, 3, 3, dimnames = list(names(d$X), names(d$X))); diag(design) <- 0
  m <- block.splsda(d$X, d$Y, ncomp = 4, keepX = e2$list.keepX, design = design)
  p <- suppressWarnings(predict(m, newdata = d$Xte))
  calls <- sapply(c("mRNA", "meth"), function(b)
    LEVELS[apply(p$predict[[b]][, , 4], 1, which.max)])
  out$predict <- list(agreeBlocks = mean(calls[, 1] == calls[, 2]),
                      perBlockBER = sapply(c("mRNA", "meth"), function(b)
                        ber(d$Yte, p$class$centroids.dist[[b]][, 4])$BER),
                      weights = p$weights)
}

# 02 cell 38's filterANOVA, vectorised: one-way ANOVA per feature row, BH
# adjusted. Checked against the lesson's own output in the leak stage (the
# feature counts 8,383 · 8,103 · 71 must come back).
anovaP <- function(M, y) {
  y <- factor(y); n <- ncol(M); k <- nlevels(y)
  mu <- rowMeans(M); ssb <- 0; ssw <- 0
  for (g in levels(y)) { Mg <- M[, y == g, drop = FALSE]; mg <- rowMeans(Mg)
    ssb <- ssb + ncol(Mg) * (mg - mu)^2; ssw <- ssw + rowSums((Mg - mg)^2) }
  p <- pf((ssb / (k - 1)) / (ssw / (n - k)), k - 1, n - k, lower.tail = FALSE)
  p.adjust(p, method = "BH")
}

if (stage == "leak") {
  suppressPackageStartupMessages(library(readr))
  raw <- file.path(nbdir, "TCGA_UCEC_2018")
  meta <- rd("meta.data.all.tsv", rows = FALSE)   # 02's own split (cell 26)
  q <- function(...) suppressWarnings(suppressMessages(read_tsv(..., show_col_types = FALSE)))
  # 02 cells 29-36: mRNA, protein-coding Approved, no NA, duplicates by max |mean|.
  pc <- q(file.path(raw, "protein-coding_gene.txt")); pc <- pc[pc$status == "Approved", ]
  mr <- as.data.frame(q(file.path(raw, "data_mrna_seq_v2_rsem_zscores_ref_normal_samples.txt")))
  mr <- mr[mr$Hugo_Symbol %in% pc$symbol, ]; mr$Entrez_Gene_Id <- NULL
  mr <- mr[complete.cases(mr), ]
  ex <- abs(rowMeans(mr[, -1])); keep <- ave(ex, mr$Hugo_Symbol, FUN = max) == ex
  mr <- mr[keep, ]; rownames(mr) <- mr$Hugo_Symbol; mr$Hugo_Symbol <- NULL
  # 02 cell 43: methylation, no NA. 02 cell 48: RPPA, no NA.
  me <- as.data.frame(q(file.path(raw, "data_methylation_hm27_hm450_merged.txt")))
  rownames(me) <- me$ENTITY_STABLE_ID; me <- me[, grepl("^TCGA", names(me))]
  me <- me[complete.cases(me), ]
  rp <- as.data.frame(q(file.path(raw, "data_rppa_zscores.txt")))
  rownames(rp) <- rp$Composite.Element.REF; rp$Composite.Element.REF <- NULL
  rp <- rp[complete.cases(rp), ]
  blocks <- list(mRNA = as.matrix(mr), meth = as.matrix(me), rppa = as.matrix(rp))
  has <- list(mRNA = meta$MRNA == "Yes", meth = meta$METH == "Yes", rppa = meta$RPPA == "Yes")
  out$unfiltered <- sapply(blocks, nrow)

  # A selector sees the labels (meta-aligned) of the samples `ids` only, and
  # returns each block's features: by BH p <= 0.001 (02's rule) or the top n.
  selBH <- function(ids, L) setNames(lapply(names(blocks), function(b) {
    s <- ids[ids %in% colnames(blocks[[b]])]
    padj <- anovaP(blocks[[b]][, s], L[match(s, meta$SAMPLE_ID)])
    rownames(blocks[[b]])[!is.na(padj) & padj <= 0.001] }), names(blocks))
  selTop <- function(n) function(ids, L) setNames(lapply(names(blocks), function(b) {
    s <- ids[ids %in% colnames(blocks[[b]])]
    padj <- anovaP(blocks[[b]][, s], L[match(s, meta$SAMPLE_ID)])
    rownames(blocks[[b]])[order(padj)][1:min(n, nrow(blocks[[b]]))] }), names(blocks))
  lab <- meta$SUBTYPE
  allIds <- meta$SAMPLE_ID
  trIds <- meta$SAMPLE_ID[meta$set == "training"]; teIds <- meta$SAMPLE_ID[meta$set == "testing"]
  lessonF <- selBH(allIds, lab)          # the lesson's way: every labelled sample
  trainF <- selBH(trIds, lab)
  out$lessonCounts <- sapply(lessonF, length)
  out$trainOnlyCounts <- sapply(trainF, length)
  out$overlap <- sapply(names(blocks), function(b) length(intersect(lessonF[[b]], trainF[[b]])))
  cat("counts lesson", out$lessonCounts, "train-only", out$trainOnlyCounts, "
")

  e2 <- new.env(); load(file.path(nbdir, "ucec.list.keepX.rda"), envir = e2)
  design <- matrix(0.1, 3, 3, dimnames = list(names(blocks), names(blocks))); diag(design) <- 0
  fitPredict <- function(F, trn, tst, ytr, blocksTest = names(blocks)) {
    X <- setNames(lapply(names(blocks), function(b) t(blocks[[b]][F[[b]], trn])), names(blocks))
    kx <- setNames(lapply(names(blocks), function(b) pmin(e2$list.keepX[[b]], length(F[[b]]))),
                   names(blocks))
    m <- block.splsda(X, factor(ytr, levels = LEVELS), ncomp = 4, keepX = kx, design = design)
    nd <- setNames(lapply(blocksTest, function(b) t(blocks[[b]][F[[b]], tst, drop = FALSE])), blocksTest)
    suppressWarnings(predict(m, newdata = nd))$WeightedVote$centroids.dist
  }
  # The external test set: features chosen with and without its labels.
  yte <- lab[match(teIds, meta$SAMPLE_ID)]; ytr <- lab[match(trIds, meta$SAMPLE_ID)]
  pl <- fitPredict(lessonF, trIds, teIds, ytr, c("mRNA", "meth"))
  pt <- fitPredict(trainF, trIds, teIds, ytr, c("mRNA", "meth"))
  out$testBER <- list(lessonFilter = sapply(1:4, function(k) ber(yte, pl[, k])$BER),
                      trainFilter = sapply(1:4, function(k) ber(yte, pt[, k])$BER))
  cat("test BER lesson", round(out$testBER$lessonFilter, 3), "train-only",
      round(out$testBER$trainFilter, 3), "\n")

  # CV on the training samples: the selector run once on all labelled samples
  # before the folds (the lesson's order), or inside each fold on its training
  # part. Real labels, then labels permuted so no subtype signal is left.
  cvRun <- function(L, sel, inside, seed = 1) {
    y <- L[match(trIds, meta$SAMPLE_ID)]
    set.seed(seed); folds <- sample(rep(1:10, length.out = length(trIds)))
    F0 <- if (!inside) sel(allIds, L) else NULL
    if (!inside && any(sapply(F0, length) < 2)) return(list(ber = rep(NA, 4), counts = sapply(F0, length)))
    pred <- matrix(NA_character_, length(trIds), 4)
    for (f in 1:10) {
      trn <- trIds[folds != f]; tst <- trIds[folds == f]
      F <- if (inside) sel(trn, L) else F0
      if (any(sapply(F, length) < 2)) return(list(ber = rep(NA, 4), counts = sapply(F, length)))
      pred[folds == f, ] <- fitPredict(F, trn, tst, y[folds != f])
    }
    list(ber = sapply(1:4, function(k) ber(y, pred[, k])$BER),
         counts = if (inside) NULL else sapply(F0, length))
  }
  out$cvReal <- list(outside = cvRun(lab, selBH, FALSE)$ber, inside = cvRun(lab, selBH, TRUE)$ber)
  cat("cv real outside", round(out$cvReal$outside, 3), "inside", round(out$cvReal$inside, 3), "
")
  nperm <- if (length(args) >= 3) as.integer(args[3]) else 3
  out$cvNull <- lapply(seq_len(nperm), function(s) {
    set.seed(1000 + s); labP <- sample(lab)
    r <- list(seed = 1000 + s,
              passBH = sapply(selBH(allIds, labP), length),
              outsideTop500 = cvRun(labP, selTop(500), FALSE)$ber,
              insideTop500 = cvRun(labP, selTop(500), TRUE)$ber)
    cat("null", s, "passBH", r$passBH, "top500 outside", round(r$outsideTop500, 3),
        "inside", round(r$insideTop500, 3), "
")
    r
  })
}

if (stage == "export") {
  # The mock's data: per training sample its subtype, each block's first two
  # PCs, the pairwise PLS comp-1 scores, and DIABLO's comp-1/2 variates at
  # three design weights. Derived numbers only; no measured value is written.
  d <- loadLesson()
  e2 <- new.env(); load(file.path(nbdir, "ucec.list.keepX.rda"), envir = e2)
  r3 <- function(x) round(as.numeric(x), 3)
  pcs <- lapply(d$X, function(X) prcomp(X, center = TRUE, scale. = TRUE, rank. = 2))
  out$subtype <- as.character(d$Y)
  out$pc <- lapply(pcs, function(p) list(pc1 = r3(p$x[, 1]), pc2 = r3(p$x[, 2]),
                                        var = r3((p$sdev^2 / sum(p$sdev^2))[1:2])))
  r <- pls(d$X$mRNA, d$X$meth, ncomp = 1)
  out$pls <- list(mRNA = r3(r$variates$X[, 1]), meth = r3(r$variates$Y[, 1]))
  out$diablo <- lapply(c(0.1, 0.5, 1), function(w) {
    design <- matrix(w, 3, 3, dimnames = list(names(d$X), names(d$X))); diag(design) <- 0
    m <- block.splsda(d$X, d$Y, ncomp = 4, keepX = e2$list.keepX, design = design)
    list(w = w, var = lapply(m$variates[names(d$X)], function(V)
      list(c1 = r3(V[, 1]), c2 = r3(V[, 2]))),
      top = lapply(names(d$X), function(b) { s <- selectVar(m, block = b, comp = 1)[[b]]
        list(name = head(s$name, 10), value = r3(head(s$value$value.var, 10))) }))
  })
  # Predict at the lesson's 0.1 (05 cells 17-24): where each test sample lands
  # in each block's component space, each block's call and the weighted vote,
  # with 2 components (the lesson's [,2]) and with 4.
  design <- matrix(0.1, 3, 3, dimnames = list(names(d$X), names(d$X))); diag(design) <- 0
  m <- block.splsda(d$X, d$Y, ncomp = 4, keepX = e2$list.keepX, design = design)
  p <- suppressWarnings(predict(m, newdata = d$Xte))
  out$predict <- list(
    truth = d$Yte,
    var = lapply(p$variates, function(V) list(c1 = r3(V[, 1]), c2 = r3(V[, 2]))),
    train = lapply(m$variates[c("mRNA", "meth")], function(V) list(c1 = r3(V[, 1]), c2 = r3(V[, 2]))),
    call2 = lapply(p$class$centroids.dist, function(C) C[, 2]),
    call4 = lapply(p$class$centroids.dist, function(C) C[, 4]),
    vote2 = p$WeightedVote$centroids.dist[, 2], vote4 = p$WeightedVote$centroids.dist[, 4],
    weights = r3(unlist(p$weights)))
}

if (stage == "factor") {
  # 99 round 1 (his "how PLS is done ... matrix factorization"): the mRNA-meth
  # pair's component-1 weights w (PLS) and PC1 rotation (PCA), the scores, and
  # the share of each block a rank-one t cᵀ leaves behind (mixOmics deflates
  # by c = Xᵀt / tᵀt). Samples sorted by subtype for the mock's columns.
  d <- loadLesson()
  r4 <- function(x) round(as.numeric(x), 4)
  o <- order(as.integer(d$Y))
  Xs <- lapply(d$X[c("mRNA", "meth")], scale)
  r <- pls(d$X$mRNA, d$X$meth, ncomp = 1)
  pc <- lapply(Xs, function(X) prcomp(X, center = FALSE, scale. = FALSE, rank. = 1))
  resid <- function(X, t) { c <- crossprod(X, t) / sum(t^2); 1 - sum((X - t %*% t(c))^2) / sum(X^2) }
  out$subtype <- as.character(d$Y)[o]
  out$pls <- list(wA = r4(r$loadings$X[, 1]), wB = r4(r$loadings$Y[, 1]),
                  t = r4(r$variates$X[o, 1]), u = r4(r$variates$Y[o, 1]),
                  keptA = resid(Xs$mRNA, r$variates$X[, 1]), keptB = resid(Xs$meth, r$variates$Y[, 1]))
  out$pca <- list(wA = r4(pc$mRNA$rotation[, 1]), wB = r4(pc$meth$rotation[, 1]),
                  t = r4(pc$mRNA$x[o, 1]), u = r4(pc$meth$x[o, 1]),
                  keptA = resid(Xs$mRNA, pc$mRNA$x[, 1]), keptB = resid(Xs$meth, pc$meth$x[, 1]))
  out$genes <- colnames(d$X$mRNA); out$sites <- colnames(d$X$meth)
  # the iteration from a poor start on the real blocks: r after each alternation
  set.seed(1); u <- d$X$meth %*% rnorm(ncol(d$X$meth)); A <- Xs$mRNA; B <- Xs$meth; rs <- c()
  for (k in 1:8) { w1 <- crossprod(A, u); w1 <- w1 / sqrt(sum(w1^2)); t <- A %*% w1
    w2 <- crossprod(B, t); w2 <- w2 / sqrt(sum(w2^2)); u <- B %*% w2; rs <- c(rs, cor(t, u)) }
  out$iterR <- rs
  cat("kept PLS", out$pls$keptA, out$pls$keptB, "PCA", out$pca$keptA, out$pca$keptB, "\niter r", round(rs, 3), "\n")
}

if (stage == "widget99") {
  # widgets/shared-components/data.js: per training sample its subtype, each
  # block's PC1 score, and per pair the PLS component-1 scores, with the share
  # of each block's (scaled) variance each direction keeps. Signs: a PLS pair
  # positively correlated, and each PC1 turned to agree with its block's PLS
  # score in the mRNA pair, so a switch of method moves the samples the least.
  d <- loadLesson()
  r3 <- function(x) round(as.numeric(x), 3)
  pcs <- lapply(d$X, function(X) prcomp(X, center = TRUE, scale. = TRUE, rank. = 1))
  pc1 <- lapply(pcs, function(p) p$x[, 1])
  pairs <- list(c("mRNA", "meth"), c("mRNA", "rppa"), c("meth", "rppa"))
  P <- lapply(pairs, function(ab) {
    r <- pls(d$X[[ab[1]]], d$X[[ab[2]]], ncomp = 1)
    t <- r$variates$X[, 1]; u <- r$variates$Y[, 1]
    if (cor(t, u) < 0) u <- -u
    list(a = ab[1], b = ab[2], t = t, u = u,
         varA = varShare(d$X[[ab[1]]], r$loadings$X[, 1]),
         varB = varShare(d$X[[ab[2]]], r$loadings$Y[, 1]))
  })
  ref <- list(mRNA = P[[1]]$t, meth = P[[1]]$u, rppa = P[[2]]$u)
  for (b in names(pc1)) if (cor(pc1[[b]], ref[[b]]) < 0) pc1[[b]] <- -pc1[[b]]
  js <- c("/* GENERATED by _lab/multiomics-measure.R widget99 from the lesson's own",
    "   preprocessed TCGA-UCEC blocks (PHM5003 10, 03 cells 3-8): the 405 training",
    "   samples. Derived numbers only: component scores and variance shares. */",
    sprintf("export const SUBTYPES = %s;", toJSON(LEVELS)),
    sprintf("export const Y = %s;", toJSON(match(as.character(d$Y), LEVELS) - 1)),
    sprintf("export const BLOCKS = %s;", toJSON(setNames(lapply(names(d$X), function(b) list(
      features = ncol(d$X[[b]]), pc1 = r3(pc1[[b]]),
      var = round(pcs[[b]]$sdev[1]^2 / sum(pcs[[b]]$sdev^2), 4))), names(d$X)), auto_unbox = TRUE)),
    sprintf("export const PAIRS = %s;", toJSON(lapply(P, function(p) list(
      a = p$a, b = p$b, t = r3(p$t), u = r3(p$u),
      varA = round(p$varA, 4), varB = round(p$varB, 4))), auto_unbox = TRUE)))
  dest <- normalizePath(file.path(here, "../shared-components"), mustWork = FALSE)
  dir.create(dest, showWarnings = FALSE)
  con <- file(file.path(dest, "data.js"), "wb"); writeLines(js, con, sep = "
", useBytes = TRUE); close(con)
  out$wrote <- file.path(dest, "data.js")
  out$check <- lapply(P, function(p) list(pair = paste(p$a, p$b), plsR = cor(p$t, p$u),
    pcaR = cor(pc1[[p$a]], pc1[[p$b]]), varA = p$varA, varB = p$varB))
  print(out$check)
}

f <- file.path(here, paste0("multiomics-", stage, ".json"))
writeLines(toJSON(out, auto_unbox = TRUE, digits = 6, pretty = TRUE), f)
cat("wrote", f, "\n")
