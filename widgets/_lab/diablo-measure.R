# Measurements for slot 100 `diablo`, on the lesson's own TCGA-UCEC data
# (PHM5003 10, 03 cells 10-28 and 05 cells 17-24), before its mock.
#
#   Rscript diablo-measure.R <stage>
#
# stage:
#   perfcheck  what 05 cell 6's table is the CV of (it loads 03's
#              perf.diablo.ucec.rds, fitted on block.plsda at ncomp 5)
#   vote       05 cell 23's weighted vote on the 102 test samples (no RPPA):
#              who wins when mRNA and methylation disagree
#   cv         one 10-fold CV, the same folds for every arm, at the lesson's
#              design 0.1 and 4 components: each block's own call, the vote
#              with all three blocks and with RPPA dropped, and block.plsda
#              (every feature) against block.splsda (the lesson's keepX)
#   toy        block.plsda on _lab/diablo-toy.csv at four design weights,
#              to check the mock's hand-written loop against the library
#
# Writes _lab/diablo-<stage>.json (untracked).

suppressPackageStartupMessages({
  library(mixOmics)
  library(jsonlite)
})

args <- commandArgs(trailingOnly = TRUE)
stage <- if (length(args) >= 1) args[1] else "vote"
here <- dirname(normalizePath(sub("^--file=", "",
  grep("^--file=", commandArgs(FALSE), value = TRUE)[1])))
nbdir <- normalizePath(file.path(here, "../../../jupyterbook/phm5003/notebook/10 - Multi-omics Analysis"))
out <- list(stage = stage, mixOmics = as.character(packageVersion("mixOmics")))
LEVELS <- c("CN_HIGH", "CN_LOW", "MSI", "POLE")

rd <- function(f, rows = TRUE) read.delim(file.path(nbdir, f), header = TRUE,
  row.names = if (rows) 1 else NULL, stringsAsFactors = FALSE, check.names = FALSE)
loadLesson <- function() {
  meta <- rd("meta.data.all.tsv", rows = FALSE)
  mrna <- rd("mrna_data_all.tsv"); meth <- rd("meth_data_all.tsv"); rppa <- rd("rppa_data_all.tsv")
  tr <- meta[meta$set == "training", ]; te <- meta[meta$set == "testing", ]
  list(X = list(mRNA = t(mrna[, tr$SAMPLE_ID]), meth = t(meth[, tr$SAMPLE_ID]), rppa = t(rppa[, tr$SAMPLE_ID])),
       Xte = list(mRNA = t(mrna[, te$SAMPLE_ID]), meth = t(meth[, te$SAMPLE_ID])),
       Y = factor(tr$SUBTYPE, levels = LEVELS, ordered = TRUE), Yte = te$SUBTYPE)
}
ber <- function(truth, pred) {
  truth <- as.character(truth); pred <- as.character(pred)
  mean(sapply(LEVELS, function(l) mean(pred[truth == l] != l, na.rm = TRUE)))
}
design01 <- function(w = 0.1) { d <- matrix(w, 3, 3, dimnames = list(c("mRNA", "meth", "rppa"), c("mRNA", "meth", "rppa"))); diag(d) <- 0; d }
keepX <- function() { e <- new.env(); load(file.path(nbdir, "ucec.list.keepX.rda"), envir = e); e$list.keepX }

if (stage == "perfcheck") {
  e <- new.env(); load(file.path(nbdir, "perf.diablo.ucec.rds"), envir = e)
  p <- e$perf.diablo.ucec
  out$class <- class(p)
  out$call <- paste(deparse(p$call), collapse = " ")
  out$columns <- colnames(p$WeightedVote.error.rate$centroids.dist)
  out$BER <- p$WeightedVote.error.rate$centroids.dist["Overall.BER", ]
  print(p$call); print(out$columns); print(round(out$BER, 4))
}

if (stage == "vote") {
  d <- loadLesson()
  e <- new.env(); load(file.path(nbdir, "diablo.ucec.rds"), envir = e); m <- e$diablo.ucec
  p <- suppressWarnings(predict(m, newdata = d$Xte))
  out$weights <- rowMeans(m$weights)
  out$byComp <- lapply(1:4, function(k) {
    a <- p$class$centroids.dist$mRNA[, k]; b <- p$class$centroids.dist$meth[, k]
    v <- p$WeightedVote$centroids.dist[, k]
    dis <- a != b
    list(k = k, disagree = sum(dis), voteIsMRNA = sum(v == a), voteIsMeth = sum(v == b),
         disagreeWonByMRNA = sum(v[dis] == a[dis]),
         ber = c(mRNA = ber(d$Yte, a), meth = ber(d$Yte, b), vote = ber(d$Yte, v)))
  })
  print(round(out$weights, 4)); str(out$byComp)
}

if (stage == "cv") {
  d <- loadLesson(); kx <- keepX()
  set.seed(123)
  # stratified folds, as perf's Mfold
  fold <- integer(length(d$Y))
  for (l in LEVELS) { i <- which(d$Y == l); fold[i] <- sample(rep_len(1:10, length(i))) }
  ncomp <- 4
  calls <- function(p, blocks) {
    r <- list()
    for (b in blocks) r[[b]] <- p$class$centroids.dist[[b]][, 1:ncomp, drop = FALSE]
    r$vote <- p$WeightedVote$centroids.dist[, 1:ncomp, drop = FALSE]
    r
  }
  arms <- list(sparse3 = list(), sparse2 = list(), full3 = list(), full2 = list())
  for (f in 1:10) {
    tr <- fold != f; te <- fold == f
    Xtr <- lapply(d$X, function(M) M[tr, , drop = FALSE])
    Xte3 <- lapply(d$X, function(M) M[te, , drop = FALSE]); Xte2 <- Xte3[c("mRNA", "meth")]
    ms <- block.splsda(Xtr, d$Y[tr], ncomp = ncomp, keepX = kx, design = design01())
    mf <- block.plsda(Xtr, d$Y[tr], ncomp = ncomp, design = design01())
    arms$sparse3[[f]] <- calls(predict(ms, newdata = Xte3), names(Xte3))
    arms$sparse2[[f]] <- calls(suppressWarnings(predict(ms, newdata = Xte2)), names(Xte2))
    arms$full3[[f]] <- calls(predict(mf, newdata = Xte3), names(Xte3))
    arms$full2[[f]] <- calls(suppressWarnings(predict(mf, newdata = Xte2)), names(Xte2))
    cat("fold", f, "done\n")
  }
  # reassemble each arm's calls in sample order
  idx <- unlist(lapply(1:10, function(f) which(fold == f)))
  stitch <- function(arm, what) { M <- do.call(rbind, lapply(arm, function(r) r[[what]])); M[order(idx), , drop = FALSE] }
  truth <- as.character(d$Y)
  out$arms <- lapply(names(arms), function(a) {
    whats <- names(arms[[a]][[1]])
    C <- setNames(lapply(whats, function(w) stitch(arms[[a]], w)), whats)
    res <- list(arm = a, ber = lapply(C, function(M) sapply(1:ncomp, function(k) ber(truth, M[, k]))))
    if ("rppa" %in% whats) {
      res$voteOverrulesMRNA <- sapply(1:ncomp, function(k) sum(C$vote[, k] != C$mRNA[, k]))
      res$allThreeDisagree <- sapply(1:ncomp, function(k) sum(C$mRNA[, k] != C$meth[, k] & C$meth[, k] != C$rppa[, k] & C$mRNA[, k] != C$rppa[, k]))
    } else {
      res$voteIsMRNA <- sapply(1:ncomp, function(k) sum(C$vote[, k] == C$mRNA[, k]))
    }
    res
  })
  str(out$arms)
}

if (stage == "toy") {
  T <- read.csv(file.path(here, "diablo-toy.csv"))
  X <- list(mRNA = as.matrix(T[, c("a1", "a2")]), meth = as.matrix(T[, c("b1", "b2")]))
  Y <- factor(T$g)
  out$fits <- lapply(c(0, 0.1, 0.5, 1), function(w) {
    des <- matrix(w, 2, 2, dimnames = list(names(X), names(X))); diag(des) <- 0
    m <- block.plsda(X, Y, ncomp = 1, design = des)
    list(w = w, wA = m$loadings$mRNA[, 1], wB = m$loadings$meth[, 1],
         r = cor(m$variates$mRNA[, 1], m$variates$meth[, 1]),
         rY = c(cor(m$variates$mRNA[, 1], m$variates$Y[, 1]), cor(m$variates$meth[, 1], m$variates$Y[, 1])),
         iter = NA)
  })
  for (f in out$fits) cat("w", f$w, "wA", round(f$wA, 4), "wB", round(f$wB, 4), "r", round(f$r, 3), "rY", round(f$rY, 3), "\n")
}

if (stage == "select") {
  # 03 cell 25's keepX on component 1: the lesson's model (design 0.1) with
  # every feature (block.plsda) against its keepX (block.splsda, 25 · 9 · 15
  # on component 1). mRNA's loading vector in full, the 25 kept, and how each
  # component-1 score separates the subtypes.
  d <- loadLesson(); kx <- keepX()
  mf <- block.plsda(d$X, d$Y, ncomp = 1, design = design01())
  ms <- block.splsda(d$X, d$Y, ncomp = 1, keepX = lapply(kx, function(v) v[1]), design = design01())
  eta <- function(t) summary(lm(t ~ factor(as.character(d$Y))))$r.squared
  wf <- mf$loadings$mRNA[, 1]; ws <- ms$loadings$mRNA[, 1]
  if (cor(mf$variates$mRNA[, 1], ms$variates$mRNA[, 1]) < 0) ws <- -ws
  keptNames <- names(ws)[ws != 0]
  out$p <- length(wf)
  out$full <- round(unname(wf), 5)
  out$genes <- names(wf)
  out$kept <- list(name = keptNames, value = round(unname(ws[keptNames]), 4), fullValue = round(unname(wf[keptNames]), 5),
                   fullRank = match(keptNames, names(sort(-abs(wf)))))
  out$keptInFullTop25 <- sum(keptNames %in% names(sort(-abs(wf)))[1:25])
  out$eta <- list(full = sapply(names(d$X), function(b) eta(mf$variates[[b]][, 1])),
                  sparse = sapply(names(d$X), function(b) eta(ms$variates[[b]][, 1])))
  out$rScore <- cor(mf$variates$mRNA[, 1], ms$variates$mRNA[, 1])
  out$subtype <- as.character(d$Y)
  out$score <- list(full = round(mf$variates$mRNA[, 1], 3), sparse = round(ms$variates$mRNA[, 1] * sign(out$rScore), 3))
  cat("kept in full top 25:", out$keptInFullTop25, " full ranks of kept:", out$kept$fullRank, "\n")
  cat("eta full", round(out$eta$full, 3), " sparse", round(out$eta$sparse, 3), " r(score full, sparse)", round(out$rScore, 3), "\n")
}

if (stage == "sweep") {
  # the TCGA design page: the lesson's model (keepX, 4 components) at four
  # design weights, each block's component-1 and -2 scores and the kept mRNA
  # genes on component 1. Error rates stay in multiomics-design.json.
  d <- loadLesson(); kx <- keepX()
  out$subtype <- as.character(d$Y)
  out$fits <- lapply(c(0, 0.1, 0.5, 1), function(w) {
    m <- block.splsda(d$X, d$Y, ncomp = 2, keepX = lapply(kx, function(v) v[1:2]), design = design01(w))
    V <- lapply(names(d$X), function(b) round(m$variates[[b]][, 1:2], 3))
    names(V) <- names(d$X)
    list(w = w, var = lapply(V, function(M) list(c1 = M[, 1], c2 = M[, 2])),
         r = { C <- cor(sapply(names(d$X), function(b) m$variates[[b]][, 1])); C[upper.tri(C)] },
         genes = selectVar(m, block = "mRNA", comp = 1)$mRNA$name)
  })
  for (f in out$fits) cat("w", f$w, "r", round(f$r, 3), "\n")
}

if (stage == "widget100") {
  # widgets/diablo/data.js. Derived numbers only: component scores, loadings,
  # calls, error rates; no measured value is written.
  #   SWEEP    Weight page: the lesson's model (keepX, design w) at four
  #            weights, each block's component-1 score; CV BER at 4
  #            components from multiomics-design.json (10-fold x 3).
  #   SELECT   Select page: mRNA's last update at design 0.1, X'z over all
  #            8,383 genes BEFORE the keepX cut (z = 0.1 meth + 0.1 rppa +
  #            1 subtype scores, as sparse.mint.block_iteration builds it),
  #            sorted by size; cutting it to 25 and scaling to length 1 must
  #            give the model's own loadings (checked below). Scores from the
  #            uncut and the cut vector.
  #   PREDICT  Predict page: the lesson's saved model (03 cell 29) on the
  #            102 test samples, RPPA missing (05 cells 17-24).
  d <- loadLesson(); kx <- keepX()
  r3 <- function(x) round(as.numeric(x), 3)
  eta <- function(t, y) summary(lm(t ~ factor(as.character(y))))$r.squared
  des <- fromJSON(file.path(here, "multiomics-design.json"), simplifyVector = FALSE)
  cvOf <- function(w) { for (s in des$sweep) if (abs(s$w - w) < 1e-9) return(s$cvBER[[4]]); NA }
  sweep <- lapply(c(0, 0.1, 0.5, 1), function(w) {
    m <- block.splsda(d$X, d$Y, ncomp = 1, keepX = lapply(kx, function(v) v[1]), design = design01(w))
    V <- lapply(names(d$X), function(b) m$variates[[b]][, 1]); names(V) <- names(d$X)
    # one orientation for every weight: CN_HIGH scores positive on each block
    for (b in names(V)) if (mean(V[[b]][d$Y == "CN_HIGH"]) < 0) V[[b]] <- -V[[b]]
    C <- cor(do.call(cbind, V))
    list(w = w, t = lapply(V, r3), r = r3(C[upper.tri(C)]), cvBER = round(cvOf(w), 4),
         genes = selectVar(m, block = "mRNA", comp = 1)$mRNA$name)
  })
  # Select: the last mRNA update of the lesson's design, before and after the cut
  m <- block.splsda(d$X, d$Y, ncomp = 1, keepX = lapply(kx, function(v) v[1]), design = design01(0.1))
  Xm <- m$X$mRNA
  z <- 0.1 * m$variates$meth[, 1] + 0.1 * m$variates$rppa[, 1] + 1 * m$variates$Y[, 1]
  raw <- drop(crossprod(Xm, z))
  o <- order(-abs(raw)); k <- kx$mRNA[1]
  cutAt <- abs(raw[o[k + 1]])
  soft <- ifelse(rank(-abs(raw), ties.method = "first") <= k, sign(raw) * (abs(raw) - cutAt), 0)
  soft <- soft / sqrt(sum(soft^2))
  lm1 <- m$loadings$mRNA[, 1]
  # the sign mixOmics reports (selectVar, 04 cell 4): the page multiplies its
  # loadings by mixSign so a hover reads what the notebook prints
  mixSign <- sign(sum(soft * lm1))
  if (sum(soft * lm1) < 0) lm1 <- -lm1
  out$selectCheck <- max(abs(soft - lm1))
  cat("Select: |cut(X'z) - mixOmics loadings| max", signif(out$selectCheck, 3), "\n")
  wAll <- raw / sqrt(sum(raw^2))
  tAll <- drop(Xm %*% wAll); tCut <- drop(Xm %*% soft)
  if (mean(tAll[d$Y == "CN_HIGH"]) < 0) { tAll <- -tAll; tCut <- -tCut; raw <- -raw; mixSign <- -mixSign }
  select <- list(p = length(raw), keep = k, raw = signif(raw[o], 4), names = colnames(Xm)[o[1:40]],
                 cut = signif(cutAt, 4), tAll = r3(tAll), tCut = r3(tCut), r = round(cor(tAll, tCut), 4),
                 eta = round(c(eta(tAll, d$Y), eta(tCut, d$Y)), 4),
                 zParts = r3(c(meth = 0.1, rppa = 0.1, subtype = 1)), mixSign = mixSign)
  cat("Select: r(all, 25)", select$r, "eta", select$eta, "\n")
  # Predict: the lesson's saved model
  e <- new.env(); load(file.path(nbdir, "diablo.ucec.rds"), envir = e); ml <- e$diablo.ucec
  p <- suppressWarnings(predict(ml, newdata = d$Xte))
  blocksP <- c("mRNA", "meth")
  cent <- lapply(blocksP, function(b) t(sapply(LEVELS, function(l) colMeans(ml$variates[[b]][d$Y == l, , drop = FALSE]))))
  names(cent) <- blocksP
  cvj <- fromJSON(file.path(here, "diablo-cv.json"), simplifyVector = FALSE)
  s3 <- Filter(function(a) a$arm == "sparse3", cvj$arms)[[1]]
  predict <- list(
    truth = match(d$Yte, LEVELS) - 1,
    test = lapply(setNames(blocksP, blocksP), function(b) lapply(1:4, function(c) r3(p$variates[[b]][, c]))),
    train = lapply(setNames(blocksP, blocksP), function(b) lapply(1:2, function(c) r3(ml$variates[[b]][, c]))),
    centres = lapply(cent, function(M) unname(lapply(1:4, function(l) r3(M[l, ])))),
    calls = lapply(setNames(blocksP, blocksP), function(b) lapply(1:4, function(c) match(p$class$centroids.dist[[b]][, c], LEVELS) - 1)),
    vote = lapply(1:4, function(c) match(p$WeightedVote$centroids.dist[, c], LEVELS) - 1),
    weights = round(unname(rowMeans(ml$weights)), 4),
    cv = list(mRNA = round(unlist(s3$ber$mRNA), 4), meth = round(unlist(s3$ber$meth), 4), rppa = round(unlist(s3$ber$rppa), 4),
              vote = round(unlist(s3$ber$vote), 4), overrule = unlist(s3$voteOverrulesMRNA), n = length(d$Y)))
  # Weight's reference line (his pick, 2026-10-11): 03 cell 13's PLS of each
  # pair without Y, ncomp = 1 — mRNA-meth, mRNA-rppa, meth-rppa, the order of SWEEP's r
  plsR <- sapply(list(c("mRNA", "meth"), c("mRNA", "rppa"), c("meth", "rppa")), function(ab) {
    r <- pls(d$X[[ab[1]]], d$X[[ab[2]]], ncomp = 1); abs(cor(r$variates$X[, 1], r$variates$Y[, 1])) })
  cat("PLS without Y", round(plsR, 4), "
")
  js <- c("/* GENERATED by _lab/diablo-measure.R widget100 from the lesson's own",
    "   preprocessed TCGA-UCEC blocks (PHM5003 10, 03 cells 3-8) and its saved",
    "   DIABLO model (03 cell 29). Derived numbers only: component scores,",
    "   loadings, calls and error rates. Subtypes are indices into SUBTYPES. */",
    sprintf("export const SUBTYPES = %s;", toJSON(LEVELS)),
    sprintf("export const Y = %s;", toJSON(match(as.character(d$Y), LEVELS) - 1)),
    sprintf("export const FEATURES = %s;", toJSON(lapply(d$X, ncol), auto_unbox = TRUE)),
    sprintf("export const KEEPX = %s;", toJSON(lapply(kx, function(v) v[1]), auto_unbox = TRUE)),
    sprintf("export const SWEEP = %s;", toJSON(sweep, auto_unbox = TRUE)),
    sprintf("export const SELECT = %s;", toJSON(select, auto_unbox = TRUE)),
    sprintf("export const PREDICT = %s;", toJSON(predict, auto_unbox = TRUE)),
    sprintf("export const PLS_R = %s;", toJSON(round(plsR, 6), digits = 6)))
  dest <- normalizePath(file.path(here, "../diablo"), mustWork = FALSE)
  dir.create(dest, showWarnings = FALSE)
  con <- file(file.path(dest, "data.js"), "wb"); writeLines(js, con, sep = "\n", useBytes = TRUE); close(con)
  for (s in sweep) cat("w", s$w, "r", s$r, "cv", s$cvBER, "\n")
  cat("weights", predict$weights, "\n")
  quit(save = "no")
}

f <- file.path(here, paste0("diablo-", stage, ".json"))
writeLines(toJSON(out, auto_unbox = TRUE, digits = 6, pretty = TRUE), f)
cat("wrote", f, "\n")
