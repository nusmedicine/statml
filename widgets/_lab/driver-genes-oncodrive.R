# Slot 69 `driver-genes`: maftools' own `oncodrive` on the lesson's own data,
# run as 01-3 cells 2 and 15 run it, checked against cell 16's printed table,
# and traced gene by gene through the clustering the widget would draw.
#
#   Rscript widgets/_lab/driver-genes-oncodrive.R "<07 - Cancer Mutation Analysis dir>" <out dir> > widgets/_lab/driver-genes-oncodrive.txt
#
# Needs maftools, installed 2026-09-17 from Bioconductor 3.22 on Kenneth's
# approval (maftools 2.26.0 with Rhtslib, DNAcopy and pheatmap). No network.
#
# Writes two files to <out dir>, which driver-genes-measure.mjs reads to check
# its port of the score against every gene maftools scored. Neither belongs in
# the repo (TCGA-derived, as in cancer-plan-export.R):
#   oncodrive_table.tsv  brca.sig with every row, as cell 15 returns it
#   gene_positions.tsv   each gene parse_prot scores: total, placed, protLen,
#                        th, and its residues in maftools' own row order
#
# The source read from the installed package, and what it settles:
#   get_threshold(n, L): the smallest x >= 2 with dbinom(x, n, 1/L) < 0.01, a
#     point probability, with n the gene's `total` (splice sites included).
#   cluster_prot: residues with N >= th are "meaningful"; neighbours fewer than
#     5 apart merge; each cluster widens by up to 5 residues either side onto
#     non-meaningful residues; each residue in the span scores
#     (N / placed) / sqrt(2)^|pos - peak|; the gene's score is the sum. A gene
#     with no meaningful residue returns NULL and is NOT in the table.
#   oncodrive: z = (score - mean) / sd, p = 1 - pnorm(z), fdr = BH over the
#     table's rows. The background falls back to 0.279 / 0.13 when fewer than
#     100 silent-variant genes return a cluster.
suppressPackageStartupMessages({ library(maftools); library(data.table) })
args <- commandArgs(trailingOnly = TRUE)
if (length(args) != 2) stop("usage: Rscript driver-genes-oncodrive.R <lesson dir> <out dir>")
src <- args[1]
out <- args[2]
cat("maftools", as.character(packageVersion("maftools")), "· data.table", as.character(packageVersion("data.table")), "·", R.version.string, "\n")

# Run an expression, keep its messages and warnings, swallow its progress bars.
quietly <- function(expr) {
  said <- character(0)
  res <- NULL
  invisible(capture.output(res <- withCallingHandlers(expr,
    message = function(m) { said <<- c(said, trimws(conditionMessage(m))); invokeRestart("muffleMessage") },
    warning = function(w) { said <<- c(said, paste("warning:", conditionMessage(w))); invokeRestart("muffleWarning") })))
  list(res = res, said = said)
}
checks <- 0; failed <- 0
ck <- function(label, ok, note = "") {
  checks <<- checks + 1
  if (!isTRUE(ok)) failed <<- failed + 1
  cat(sprintf("  %s %s%s\n", if (isTRUE(ok)) "ok  " else "FAIL", label, if (nzchar(note)) paste0(" — ", note) else ""))
}

# ------------------------------------------------------------------ cell 2
cat("\n§1 cell 2: read.maf(rmFlags = 20)\n")
load(file.path(src, "brca_maf.rda"))        # -> mutation
load(file.path(src, "brca_clinical.rda"))   # -> clinical
r <- quietly(read.maf(maf = mutation, clinicalData = clinical, isTCGA = TRUE, rmFlags = 20))
maf <- r$res
cat(paste0("  ", r$said[!grepl("Finished", r$said)], collapse = "\n"), "\n")
ck("21,620 silent variants, as cell 2 prints", nrow(maf@maf.silent) == 21620, format(nrow(maf@maf.silent), big.mark = ","))
cat(sprintf("  %s non-synonymous variants in %s tumours\n", format(nrow(maf@data), big.mark = ","),
            length(unique(maf@data$Tumor_Sample_Barcode))))

# ------------------------------------------------------------------ cell 15
cat("\n§2 cell 15: oncodrive(AACol = 'HGVSp_Short', minMut = 5)\n")
r <- quietly(oncodrive(maf = maf, AACol = "HGVSp_Short", minMut = 5))
brca.sig <- r$res
cat(paste0("  said: ", r$said, collapse = "\n"), "\n")
ck("the background fell back to the predefined values, as cell 15 printed",
   any(grepl("Not enough genes to build background", r$said)))
cat(sprintf("  %d genes in the table\n", nrow(brca.sig)))
ck("799 genes, the m that reproduces cell 16's FDRs", nrow(brca.sig) == 799)

# cell 16, as printed: filter(fdr <= 0.05) %>% arrange(desc(MutatedSamples))
cell16 <- data.table(
  Hugo_Symbol = c("PIK3CA", "AKT1", "NDUFS1", "RPL22", "KRAS", "DPEP1", "FAM102A"),
  MutatedSamples = c(328L, 26L, 9L, 6L, 6L, 4L, 4L),
  clusters = c(10L, 1L, 1L, 1L, 1L, 2L, 2L),
  muts_in_clusters = c(342L, 25L, 9L, 6L, 5L, 4L, 4L),
  clusterScores = c(0.8043175, 0.9259259, 1, 1, 0.8333333, 0.8, 0.8),
  protLen = c(1068L, 480L, 741L, 128L, 189L, 411L, 384L),
  zscore = c(4.040904, 4.976353, 5.546154, 5.546154, 4.264103, 4.007692, 4.007692),
  pval = c(2.662280e-05, 3.239667e-07, 1.460110e-08, 1.460110e-08, 1.003536e-05, 3.065747e-05, 3.065747e-05),
  fdr = c(3.499331e-03, 8.628314e-05, 5.833137e-06, 5.833137e-06, 2.004564e-03, 3.499331e-03, 3.499331e-03),
  fract_muts_in_clusters = c(0.9268293, 0.9259259, 1, 1, 0.8333333, 0.8, 0.8))
sig <- brca.sig[fdr <= 0.05][order(-MutatedSamples)]
ck("seven genes at fdr <= 0.05, in cell 16's order", identical(sig$Hugo_Symbol, cell16$Hugo_Symbol),
   paste(sig$Hugo_Symbol, collapse = " "))
rel <- function(a, b) max(abs(a - b) / pmax(abs(b), 1e-300))
for (col in setdiff(colnames(cell16), "Hugo_Symbol")) {
  a <- as.numeric(sig[[col]]); b <- as.numeric(cell16[[col]])
  if (col %in% c("MutatedSamples", "clusters", "muts_in_clusters", "protLen")) ck(sprintf("%-22s equal in all seven rows", col), all(a == b))
  else ck(sprintf("%-22s matches to the printed digits", col), rel(a, b) < 5e-7, sprintf("largest relative difference %.1e", rel(a, b)))
}

# ------------------------------------------------------------------ the parse, replicated
# parse_prot's own lines, so each gene's residues can be traced; checked below
# by calling maftools:::cluster_prot on them for every gene in the table.
gz <- gzfile(system.file("extdata", "prot_len.txt.gz", package = "maftools"), open = "r")
gl <- data.table(read.csv(file = gz, header = TRUE, sep = "\t", stringsAsFactors = FALSE))
close(gz)
parsePositions <- function(dat) {
  d <- copy(dat)
  colnames(d)[which(colnames(d) == "HGVSp_Short")] <- "AAChange"
  a <- d[, .(Hugo_Symbol, Variant_Classification, AAChange)]
  a <- a[Variant_Classification != "Splice_Site"]
  spl <- strsplit(x = as.character(a$AAChange), split = ".", fixed = TRUE)
  a[, conv := sapply(sapply(spl, function(x) x[length(x)]), "[", 1)]
  a <- a[!conv == "NULL"]
  pos <- gsub("Ter.*", "", a$conv)
  pos <- gsub("[[:alpha:]]", "", pos)
  pos <- gsub("\\*$", "", pos)
  pos <- gsub("^\\*", "", pos)
  pos <- gsub("\\*.*", "", pos)
  pos <- suppressWarnings(as.numeric(sapply(strsplit(pos, split = "_", fixed = TRUE), "[", 1)))
  a[, pos := pos]
  a[!is.na(pos)]
}
geneTable <- function(dat, m) {
  gs <- maftools:::summarizeMaf(maf = dat, chatty = FALSE)$gene.summary
  gs <- merge(x = gs, y = gl, by = "Hugo_Symbol", all.x = TRUE)
  gs <- gs[!is.na(aa.length)]
  gs$th <- mapply(maftools:::get_threshold, gs$total, gs$aa.length)
  gs[total >= m]
}
nonsyn.pos <- parsePositions(maf@data)
nonsyn.genes <- geneTable(maf@data, 5)

# cluster_prot with its clusters kept: the same lines, returning the spans.
# Asserted equal to maftools:::cluster_prot for every gene, so it cannot drift.
clusterTrace <- function(prot.dat, th) {
  mergeDist <- 5
  pc <- prot.dat[, .N, pos][order(pos)]
  pc$meaningful <- pc$N >= th
  ct <- pc[meaningful == TRUE]; nc <- pc[meaningful == FALSE]
  if (nrow(ct) == 0) return(NULL)
  ct$distance <- c(0, diff(ct$pos))
  cdf <- data.frame(start = ct$pos[1], end = ct$pos[1], N = ct$N[1])
  if (nrow(ct) > 1) for (i in 2:nrow(ct)) {
    k <- nrow(cdf)
    if (ct$distance[i] < mergeDist) { cdf$end[k] <- ct$pos[i]; cdf$N[k] <- cdf$N[k] + ct$N[i] }
    else cdf <- rbind(cdf, data.frame(start = ct$pos[i], end = ct$pos[i], N = ct$N[i]))
  }
  cdf$coreStart <- cdf$start; cdf$coreEnd <- cdf$end
  for (i in seq_len(nrow(cdf))) {
    s <- nc$pos - cdf$start[i]; e <- nc$pos - cdf$end[i]
    before <- nc[s >= -5 & s <= 0]; after <- nc[e <= 5 & e >= 0]
    if (nrow(before) > 0) { cdf$start[i] <- before$pos[which.min(before$pos - cdf$start[i])]; cdf$N[i] <- cdf$N[i] + sum(before$N) }
    if (nrow(after) > 0) { cdf$end[i] <- after$pos[which.max(after$pos - cdf$end[i])]; cdf$N[i] <- cdf$N[i] + sum(after$N) }
  }
  placed <- nrow(prot.dat)
  cdf$peak <- ""; cdf$score <- 0; cdf$tied <- FALSE
  for (i in seq_len(nrow(cdf))) {
    t <- prot.dat[pos >= cdf$start[i] & pos <= cdf$end[i]][, .N, pos]
    peak <- t[N == max(N), pos]
    cdf$peak[i] <- paste(peak, collapse = "/")
    cdf$tied[i] <- length(peak) > 1
    cdf$score[i] <- sum((t$N / placed) / (sqrt(2)^suppressWarnings(abs(t$pos - peak))))
  }
  cdf
}

cat("\n§3 the parse replicated: maftools:::cluster_prot on each gene's residues against the table\n")
worst <- 0; mism <- 0; traced <- 0; tiedGenes <- character(0)
for (g in brca.sig$Hugo_Symbol) {
  row <- nonsyn.genes[Hugo_Symbol == g]
  pd <- nonsyn.pos[Hugo_Symbol == g]
  own <- maftools:::cluster_prot(prot.dat = pd, gene = g, th = row$th, protLen = row$aa.length)
  tr <- clusterTrace(pd, row$th)
  b <- brca.sig[Hugo_Symbol == g]
  worst <- max(worst, abs(own$clusterScores - b$clusterScores), abs(sum(tr$score) - b$clusterScores))
  if (own$clusters != b$clusters || own$muts_in_clusters != b$muts_in_clusters || nrow(tr) != b$clusters || sum(tr$N) != b$muts_in_clusters) mism <- mism + 1
  if (any(tr$tied)) tiedGenes <- c(tiedGenes, g)
  traced <- traced + 1
}
ck(sprintf("all %d genes: cluster_prot and the traced copy give the table's score, clusters and muts_in_clusters", traced),
   mism == 0 && worst < 1e-12, sprintf("%d count mismatches, largest score difference %.1e", mism, worst))
cat(sprintf("  genes with a tie for a cluster's peak: %d (%s)\n", length(tiedGenes), paste(head(tiedGenes, 12), collapse = " ")))

# ------------------------------------------------------------------ who is not in the table
cat("\n§4 genes with at least 5 mutations that the table leaves out\n")
dropped <- nonsyn.genes[!Hugo_Symbol %in% brca.sig$Hugo_Symbol]
cat(sprintf("  %d genes pass minMut = 5 and have a protein length; %d return a cluster and are tested; %d have no residue at th and are not in the table\n",
            nrow(nonsyn.genes), nrow(brca.sig), nrow(dropped)))
noLen <- maftools:::summarizeMaf(maf = maf@data, chatty = FALSE)$gene.summary[total >= 5][!Hugo_Symbol %in% gl$Hugo_Symbol]
cat(sprintf("  %d more genes with at least 5 mutations have no length in prot_len.txt.gz and are never scored\n", nrow(noLen)))
cat("  the most mutated genes left out: ", paste(sprintf("%s (%d, th %d)", head(dropped[order(-total)], 8)$Hugo_Symbol,
    head(dropped[order(-total)], 8)$total, head(dropped[order(-total)], 8)$th), collapse = ", "), "\n")

# ------------------------------------------------------------------ the silent background
cat("\n§5 the background from silent variants (why cell 15 fell back)\n")
cat("  variant classes in the silent set: ", paste(sprintf("%s %d", names(table(maf@maf.silent$Variant_Classification)),
    as.integer(table(maf@maf.silent$Variant_Classification))), collapse = ", "), "\n")
syn.genes <- geneTable(maf@maf.silent, 5)
synBackground <- function(pos) {
  sc <- c()
  for (g in syn.genes$Hugo_Symbol) {
    s <- maftools:::cluster_prot(prot.dat = pos[Hugo_Symbol == g], gene = g,
                                 th = syn.genes[Hugo_Symbol == g, th], protLen = syn.genes[Hugo_Symbol == g, aa.length])
    if (!is.null(s)) sc <- c(sc, s$clusterScores)
  }
  sc
}
silent <- maf@maf.silent[Variant_Classification == "Silent"]
syn.pos <- parsePositions(maf@maf.silent)
cat(sprintf("  Silent rows write HGVSp_Short as %s; %.2f%% end in '='; the parse leaves '%s', which as.numeric makes NA\n",
    paste(head(silent$HGVSp_Short, 3), collapse = ", "), 100 * mean(grepl("=$", silent$HGVSp_Short)),
    gsub("[[:alpha:]]", "", sub("^p\\.", "", silent$HGVSp_Short[1]))))
cat(sprintf("  silent-set variants given a residue: %d of %s\n", nrow(syn.pos), format(nrow(maf@maf.silent), big.mark = ",")))
synScores <- synBackground(syn.pos)
cat(sprintf("  %d genes have at least 5 silent-set variants and a length; %d of them return a cluster (100 needed)\n",
            nrow(syn.genes), length(synScores)))
ck("almost no silent variant is given a residue and no silent gene returns a cluster, so step 5 fell back at any gene count",
   nrow(syn.pos) <= 2 && length(synScores) == 0, sprintf("%d placed", nrow(syn.pos)))

# What step 5 would have built had the '=' been read: the same code, the same genes.
eqStripped <- copy(maf@maf.silent)
eqStripped[, HGVSp_Short := sub("=$", "", HGVSp_Short)]
synScoresEq <- synBackground(parsePositions(eqStripped))
cat(sprintf("  with the '=' stripped: %d silent-set variants placed; %d genes return a cluster (100 needed)", nrow(parsePositions(eqStripped)), length(synScoresEq)))
if (length(synScoresEq) >= 2) cat(sprintf("; their scores mean %.3f, sd %.3f, against the predefined 0.279 and 0.13\n", mean(synScoresEq), sd(synScoresEq))) else cat("\n")
if (length(synScoresEq) >= 100) {
  z <- (brca.sig$clusterScores - mean(synScoresEq)) / sd(synScoresEq)
  f <- p.adjust(1 - pnorm(z), method = "fdr")
  cat(sprintf("  on that background %d genes reach fdr <= 0.05 (against 7): %s\n", sum(f <= 0.05),
      paste(head(brca.sig$Hugo_Symbol[order(f)][sort(f) <= 0.05], 20), collapse = " ")))
}

# ------------------------------------------------------------------ the genes the widget would draw
cat("\n§6 traced genes: th, meaningful residues, clusters, score, and where each stands\n")
brca.sig[, rank := .I]
for (g in c("PIK3CA", "AKT1", "KRAS", "NDUFS1", "RPL22", "DPEP1", "FAM102A", "TP53", "CDH1", "GATA3", "MAP3K1", "KMT2C", "PTEN", "RUNX1", "CBFB", "SF3B1")) {
  row <- nonsyn.genes[Hugo_Symbol == g]
  if (nrow(row) == 0) { cat(sprintf("\n  %s: fewer than 5 mutations or no length\n", g)); next }
  pd <- nonsyn.pos[Hugo_Symbol == g]
  pc <- pd[, .N, pos][order(-N, pos)]
  cat(sprintf("\n  %s: total %d, placed %d (splice sites and unparsed changes out), protein %d aa, th %d (dbinom(%d, %d, 1/%d) = %.4f; at %d it is %.4f)\n",
      g, row$total, nrow(pd), row$aa.length, row$th, row$th, row$total, row$aa.length,
      dbinom(row$th, row$total, 1 / row$aa.length), row$th - 1, dbinom(row$th - 1, row$total, 1 / row$aa.length)))
  cat(sprintf("    residues hit: %d; at th or more: %d; busiest %s\n", nrow(pc), sum(pc$N >= row$th),
      paste(sprintf("%d:%d", head(pc$pos, 6), head(pc$N, 6)), collapse = " ")))
  tr <- clusterTrace(pd, row$th)
  if (is.null(tr)) { cat("    no residue reaches th: cluster_prot returns NULL, so the gene is NOT in the table\n"); next }
  for (i in seq_len(nrow(tr))) cat(sprintf("    cluster %d: core %d-%d, span %d-%d, N %d, peak %s%s, score %.4f\n", i, tr$coreStart[i], tr$coreEnd[i],
      tr$start[i], tr$end[i], tr$N[i], tr$peak[i], if (tr$tied[i]) " (tied)" else "", tr$score[i]))
  b <- brca.sig[Hugo_Symbol == g]
  cat(sprintf("    gene: %d clusters, %d in clusters (fraction %.3f), score %.4f, z %.3f, p %.2e, fdr %.2e, rank %d of %d\n",
      b$clusters, b$muts_in_clusters, b$fract_muts_in_clusters, b$clusterScores, b$zscore, b$pval, b$fdr, b$rank, nrow(brca.sig)))
}

# ------------------------------------------------------------------ score against fraction
cat("\n§7 what cell 18 plots (fraction in clusters) against what is tested (the score)\n")
cat(sprintf("  correlation over %d genes: %.3f\n", nrow(brca.sig), cor(brca.sig$fract_muts_in_clusters, brca.sig$clusterScores)))
cat(sprintf("  score = fraction exactly (every cluster one residue, no neighbours): %d genes\n",
    sum(abs(brca.sig$fract_muts_in_clusters - brca.sig$clusterScores) < 1e-9)))
cat(sprintf("  score needed for fdr <= 0.05 here: the lowest called is %.4f, the highest not called %.4f\n",
    min(brca.sig[fdr <= 0.05, clusterScores]), max(brca.sig[fdr > 0.05, clusterScores])))
cat(sprintf("  genes at fraction >= 0.5 not called: %d; the highest fraction not called: %.3f (%s)\n",
    nrow(brca.sig[fdr > 0.05 & fract_muts_in_clusters >= 0.5]), max(brca.sig[fdr > 0.05, fract_muts_in_clusters]),
    brca.sig[fdr > 0.05][which.max(fract_muts_in_clusters), Hugo_Symbol]))
cat("  the count's only role is minMut: called genes by total — ", paste(sprintf("%s %d", brca.sig[fdr <= 0.05][order(total)]$Hugo_Symbol,
    brca.sig[fdr <= 0.05][order(total)]$total), collapse = ", "), "\n")

# ------------------------------------------------------------------ the other pvalMethods
cat("\n§8 the same function's other p-value methods (not run in the lesson)\n")
for (method in c("poisson", "combined")) {
  r <- tryCatch(quietly(oncodrive(maf = maf, AACol = "HGVSp_Short", minMut = 5, pvalMethod = method)),
                error = function(e) list(res = NULL, said = paste("error:", conditionMessage(e))))
  if (is.null(r$res)) { cat(sprintf("\n  pvalMethod = '%s' stops: %s\n", method, paste(r$said, collapse = " | "))); next }
  t <- r$res
  called <- t[fdr <= 0.05]
  cat(sprintf("\n  pvalMethod = '%s': %d of %d genes at fdr <= 0.05\n", method, nrow(called), nrow(t)))
  if ("Expected" %in% colnames(t)) {
    below <- called[total < Expected]
    cat(sprintf("    of those, %d have FEWER mutations than the model expects (poisson.test is two-sided)\n", nrow(below)))
    cat("    called above expectation, most mutated first: ", paste(sprintf("%s %d/%.1f", head(called[total >= Expected][order(-total)], 15)$Hugo_Symbol,
        head(called[total >= Expected][order(-total)], 15)$total, head(called[total >= Expected][order(-total)], 15)$Expected), collapse = ", "), "\n")
    if (nrow(below) > 0) cat("    called below expectation: ", paste(sprintf("%s %d/%.1f", head(below[order(Expected - total, decreasing = TRUE)], 8)$Hugo_Symbol,
        head(below[order(Expected - total, decreasing = TRUE)], 8)$total, head(below[order(Expected - total, decreasing = TRUE)], 8)$Expected), collapse = ", "), "\n")
  }
  for (g in c("TP53", "CDH1", "GATA3", "MAP3K1", "PIK3CA", "NDUFS1", "RPL22", "AKT1")) {
    x <- t[Hugo_Symbol == g]
    if (nrow(x) == 0) cat(sprintf("    %-7s not in the table\n", g))
    else cat(sprintf("    %-7s total %d, expected %s, fdr %.2e%s\n", g, x$total, if ("Expected" %in% colnames(x)) sprintf("%.1f", x$Expected) else "-",
                     x$fdr, if (x$fdr <= 0.05) "  CALLED" else ""))
  }
}

# ------------------------------------------------------------------ lollipop heights
cat("\n§9 lollipopPlot's heights (cells 21 and 24) against oncodrive's per-residue counts\n")
for (q in list(list("PIK3CA", c(1047, 545, 542, 345)), list("TP53", c(175, 273, 248, 342)))) {
  pd <- nonsyn.pos[Hugo_Symbol == q[[1]]]
  for (p in q[[2]]) {
    x <- pd[pos == p, .N, conv][order(-N)]
    cat(sprintf("  %s residue %d: %d mutations — %s\n", q[[1]], p, sum(x$N), paste(sprintf("%s %d", x$conv, x$N), collapse = ", ")))
  }
}

# ------------------------------------------------------------------ one tumour, one record
# read.maf(isTCGA = TRUE) cuts each barcode to 12 characters, so a patient's
# second aliquot (01A and 01B, or a primary 01A and a metastasis 06A) becomes
# the same "sample" and every mutation both aliquots carry is counted twice at
# its residue. A two-base change is also written as two rows on adjacent bases.
cat("\n§10 oncodrive with each mutation counted once per tumour\n")
mut <- as.data.table(mutation)
mut[, tsb := substr(Tumor_Sample_Barcode, 1, 12)]
aliquots <- mut[, .(n = uniqueN(Tumor_Sample_Barcode)), by = tsb][n > 1]
cat(sprintf("  tumours with more than one aliquot in the MAF: %d\n", nrow(aliquots)))
once <- unique(mut, by = c("tsb", "Chromosome", "Start_Position", "Tumor_Seq_Allele2"))
cat(sprintf("  rows %s -> %s with each (tumour, position, allele) kept once\n", format(nrow(mut), big.mark = ","), format(nrow(once), big.mark = ",")))
setorder(once, tsb, Chromosome, Start_Position)
once[, `:=`(prevPos = shift(Start_Position), prevGene = shift(Hugo_Symbol), prevType = shift(Variant_Type)), by = .(tsb, Chromosome)]
pairSecond <- once[Variant_Type == "SNP" & prevType %in% "SNP" & Start_Position - prevPos == 1 & Hugo_Symbol == prevGene]
onceMerged <- once[!pairSecond, on = c("tsb", "Chromosome", "Start_Position", "Tumor_Seq_Allele2")]
cat(sprintf("  adjacent-base SNV pairs in one tumour and one gene: %d; dropping the second row of each leaves %s rows\n",
    nrow(pairSecond), format(nrow(onceMerged), big.mark = ",")))
for (v in list(list("each mutation once per tumour", once), list("and each two-base change once", onceMerged))) {
  d <- as.data.frame(v[[2]][, !c("tsb", "prevPos", "prevGene", "prevType")])
  mm <- quietly(read.maf(maf = d, clinicalData = clinical, isTCGA = TRUE, rmFlags = 20))$res
  t <- quietly(oncodrive(maf = mm, AACol = "HGVSp_Short", minMut = 5))$res
  cat(sprintf("\n  %s: %d genes tested, %d at fdr <= 0.05: %s\n", v[[1]], nrow(t), nrow(t[fdr <= 0.05]),
      paste(sprintf("%s (%d, score %.3f)", t[fdr <= 0.05][order(-MutatedSamples)]$Hugo_Symbol, t[fdr <= 0.05][order(-MutatedSamples)]$total,
                    t[fdr <= 0.05][order(-MutatedSamples)]$clusterScores), collapse = ", ")))
  for (g in c("DPEP1", "FAM102A", "AKT1", "RGS17")) {
    x <- t[Hugo_Symbol == g]
    tot <- maftools:::summarizeMaf(maf = mm@data, chatty = FALSE)$gene.summary[Hugo_Symbol == g, total]
    if (nrow(x) == 0) cat(sprintf("    %-7s %s mutations: not in the table\n", g, if (length(tot)) tot else 0))
    else cat(sprintf("    %-7s %d mutations, score %.3f, fdr %.2e\n", g, x$total, x$clusterScores, x$fdr))
  }
}

# ------------------------------------------------------------------ export for the JS port
dir.create(out, showWarnings = FALSE, recursive = TRUE)
write.table(brca.sig, file.path(out, "oncodrive_table.tsv"), sep = "\t", quote = FALSE, row.names = FALSE)
rows <- list()
for (g in nonsyn.genes$Hugo_Symbol) {
  row <- nonsyn.genes[Hugo_Symbol == g]
  pc <- nonsyn.pos[Hugo_Symbol == g][, .N, pos]          # first-appearance order, as cluster_prot's summaries are
  rows[[g]] <- data.table(Hugo_Symbol = g, total = row$total, placed = sum(pc$N), protLen = row$aa.length, th = row$th,
                          order = seq_len(nrow(pc)), pos = pc$pos, N = pc$N)
}
write.table(rbindlist(rows), file.path(out, "gene_positions.tsv"), sep = "\t", quote = FALSE, row.names = FALSE)
cat(sprintf("\nwrote oncodrive_table.tsv (%d genes) and gene_positions.tsv (%d genes) to the out dir\n", nrow(brca.sig), length(rows)))
cat(sprintf("\n%d checks, %d failed\n", checks, failed))
