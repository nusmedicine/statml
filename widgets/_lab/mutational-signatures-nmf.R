# Slot 70 `mutational-signatures`: 01-4 run as the lesson ran it, on the
# lesson's own data, and checked against every number the notebook printed.
#
#   Rscript widgets/_lab/mutational-signatures-nmf.R "<07 - Cancer Mutation Analysis dir>" <out dir> > widgets/_lab/mutational-signatures-nmf.txt
#
# Needs maftools (2.26.0, installed 2026-09-17) and NMF (0.28, installed from
# CRAN on Kenneth's approval 2026-09-18, with Biobase from Bioconductor 3.22).
# No network, and no BSgenome: cell 11's `trinucleotideMatrix` reads each
# base's neighbours from BSgenome.Hsapiens.UCSC.hg38, and this script reads
# them from the MAF's own 11-base CONTEXT column instead, through maftools'
# own conversion lines (below), so the matrix is the one cell 11 built if the
# two references agree. §1 checks that on cells 12 and 14.
#
# Writes to <out dir>, for mutational-signatures-measure.mjs (TCGA-derived, so
# not in the repo, as cancer-plan-export.R):
#   tnm.tsv           the 968 x 96 matrix, rows in cell 11's order
#   lesson_sigs.tsv   cell 21's five signatures, all 96 rows
#   lesson_expo.tsv   their contributions_abs, 5 x 968
#   ref_legacy.tsv, ref_SBS.tsv, aet_legacy.tsv, aet_SBS.tsv
#                     the two reference catalogues maftools ships and cells 24
#                     and 30 compare against, with their aetiologies. COSMIC's,
#                     so never in the repo: its terms forbid exposing the data
#                     on a public website without GRL's written consent. The
#                     measure reads them only to score the look-alikes.
suppressPackageStartupMessages({ library(maftools); library(data.table); library(NMF) })
args <- commandArgs(trailingOnly = TRUE)
if (length(args) != 2) stop("usage: Rscript mutational-signatures-nmf.R <lesson dir> <out dir>")
src <- args[1]
out <- args[2]
dir.create(out, showWarnings = FALSE, recursive = TRUE)
cat("maftools", as.character(packageVersion("maftools")), "· NMF", as.character(packageVersion("NMF")),
    "·", R.version.string, "· RNG", paste(RNGkind(), collapse = "/"), "\n")

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
cosine <- function(a, b) sum(a * b) / sqrt(sum(a * a) * sum(b * b))

# ------------------------------------------------------------------ cell 2
cat("\n§1 cells 2, 4, 11, 12 and 14: the MAF, Ti/Tv, and the 96-channel matrix\n")
load(file.path(src, "brca_maf.rda"))        # -> mutation
load(file.path(src, "brca_clinical.rda"))   # -> clinical
maf <- quietly(read.maf(maf = mutation, clinicalData = clinical, isTCGA = TRUE, rmFlags = 20))$res
ck("21,620 silent variants, as cell 2 prints", nrow(maf@maf.silent) == 21620)

# cell 4: titv(useSyn = TRUE), its first six rows as printed
titv <- quietly(titv(maf = maf, plot = FALSE, useSyn = TRUE))$res
fc <- as.data.frame(titv$fraction.contribution)
cell4 <- data.frame(
  Tumor_Sample_Barcode = c("TCGA-3C-AAAU", "TCGA-3C-AALI", "TCGA-3C-AALJ", "TCGA-3C-AALK", "TCGA-4H-AAAK", "TCGA-5L-AAT0"),
  `C>A` = c(8.695652, 9.724771, 19.230769, 18.367347, 23.809524, 7.228916),
  `C>G` = c(4.347826, 39.633028, 7.692308, 14.285714, 4.761905, 22.891566),
  `C>T` = c(60.86957, 45.87156, 53.84615, 57.14286, 57.14286, 64.45783),
  `T>C` = c(21.739130, 1.651376, 11.538462, 8.163265, 14.285714, 1.204819),
  `T>A` = c(4.347826, 2.752294, 3.846154, 2.040816, 0.000000, 1.807229),
  `T>G` = c(0.0000000, 0.3669725, 3.8461538, 0.0000000, 0.0000000, 2.4096386), check.names = FALSE)
h6 <- head(fc, 6)
d4 <- max(abs(as.matrix(h6[, c("C>A", "C>G", "C>T", "T>C", "T>A", "T>G")]) - as.matrix(cell4[, -1])))
ck("cell 4's six printed rows of fraction.contribution", identical(as.character(h6$Tumor_Sample_Barcode), cell4$Tumor_Sample_Barcode) && d4 < 1e-5,
   sprintf("largest difference %.1e", d4))
tv <- as.data.frame(titv$TiTv.fractions)
cat(sprintf("  cell 6's boxes, medians over %d tumours: C>T %.1f%%, C>A %.1f%%, C>G %.1f%%, T>C %.1f%%, T>A %.1f%%, T>G %.1f%%; Ti %.1f%%, Tv %.1f%%\n",
    nrow(fc), median(fc$`C>T`), median(fc$`C>A`), median(fc$`C>G`), median(fc$`T>C`), median(fc$`T>A`), median(fc$`T>G`),
    median(tv$Ti), median(tv$Tv)))

# cell 11, with the neighbours read from CONTEXT. The lines from `conv` to the
# dcast are trinucleotideMatrix's own (maftools 2.26.0), unchanged.
query <- subsetMaf(maf = maf, query = "Variant_Type %in% 'SNP'", fields = c("Chromosome", "CONTEXT"), includeSyn = TRUE, mafObj = FALSE)
query <- query[!is.na(Start_Position)]
ctx <- as.character(query$CONTEXT)
ck("every SNP carries an 11-base CONTEXT centred on its reference base",
   all(nchar(ctx) == 11) && all(substr(ctx, 6, 6) == query$Reference_Allele),
   sprintf("%d SNPs, %d with another length, %d off-centre", nrow(query), sum(nchar(ctx) != 11), sum(substr(ctx, 6, 6) != query$Reference_Allele)))
extract.tbl <- data.table(Reference_Allele = query$Reference_Allele, Tumor_Seq_Allele2 = query$Tumor_Seq_Allele2,
                          Tumor_Sample_Barcode = query$Tumor_Sample_Barcode, trinucleotide = substr(ctx, 5, 7))
extract.tbl[, Substitution := paste(Reference_Allele, Tumor_Seq_Allele2, sep = ">")]
conv <- c("T>C", "T>C", "C>T", "C>T", "T>A", "T>A", "T>G", "T>G", "C>A", "C>A", "C>G", "C>G")
names(conv) <- c("A>G", "T>C", "C>T", "G>A", "A>T", "T>A", "A>C", "T>G", "C>A", "G>T", "C>G", "G>C")
extract.tbl$SubstitutionType <- conv[extract.tbl$Substitution]
complement <- c("A", "C", "G", "T"); names(complement) <- c("T", "G", "C", "A")
complemented.triplets <- paste(complement[substr(extract.tbl$trinucleotide, 3, 3)], "[", extract.tbl$SubstitutionType, "]",
                               complement[substr(extract.tbl$trinucleotide, 1, 1)], sep = "")
swap.ind <- which(substr(extract.tbl$Substitution, 1, 1) %in% c("G", "A"))
motif <- paste(substr(extract.tbl$trinucleotide, 1, 1), "[", extract.tbl$SubstitutionType, "]", substr(extract.tbl$trinucleotide, 3, 3), sep = "")
motif[swap.ind] <- complemented.triplets[swap.ind]
subtype.levels <- unlist(lapply(c("C>A", "C>G", "C>T", "T>A", "T>C", "T>G"), function(s)
  unlist(lapply(c("A", "C", "G", "T"), function(l) paste0(l, "[", s, "]", c("A", "C", "G", "T"))))))
extract.tbl$SubstitutionTypeMotif <- factor(motif, levels = subtype.levels)
cat(sprintf("  %s SNPs (silent included, useSyn = TRUE); %s (%.1f%%) have a purine reference and are read from the other strand\n",
    format(nrow(extract.tbl), big.mark = ","), format(length(swap.ind), big.mark = ","), 100 * length(swap.ind) / nrow(extract.tbl)))
s12 <- table(factor(extract.tbl$Substitution, levels = names(conv)))
cat("  the twelve written changes: ", paste(sprintf("%s %d", names(s12), as.integer(s12)), collapse = ", "), "\n")
s6 <- table(factor(extract.tbl$SubstitutionType, levels = unique(conv)))
cat("  folded to six: ", paste(sprintf("%s %d (%.1f%%)", names(s6), as.integer(s6), 100 * as.integer(s6) / sum(s6)), collapse = ", "), "\n")
summ <- extract.tbl[, .N, by = list(Tumor_Sample_Barcode, SubstitutionTypeMotif)]
conv.mat <- as.data.frame(data.table::dcast(summ, formula = Tumor_Sample_Barcode ~ SubstitutionTypeMotif, fill = 0, value.var = "N", drop = FALSE))
rownames(conv.mat) <- conv.mat[, 1]
conv.mat <- conv.mat[, -1]
missing <- subtype.levels[!subtype.levels %in% colnames(conv.mat)]
if (length(missing)) conv.mat <- cbind(conv.mat, setNames(as.data.frame(matrix(0, nrow(conv.mat), length(missing))), missing))
conv.mat <- as.matrix(conv.mat[, match(subtype.levels, colnames(conv.mat))])
conv.mat[is.na(conv.mat)] <- 0
tnm <- list(nmf_matrix = conv.mat)
ck("968 x 96, as cell 11 prints", nrow(conv.mat) == 968 && ncol(conv.mat) == 96, paste(dim(conv.mat), collapse = " x "))
cell12 <- rbind(
  c(0, 1, 1, 0, 0, 0, 0, 0), c(3, 1, 0, 1, 4, 3, 0, 2), c(0, 1, 1, 0, 0, 0, 1, 0),
  c(0, 0, 0, 0, 0, 1, 0, 1), c(1, 2, 0, 0, 0, 0, 1, 0), c(0, 0, 0, 0, 2, 0, 0, 0))
ck("cell 12's printed head: the same six tumours in the same order, the first eight channels equal",
   identical(rownames(conv.mat)[1:6], c("TCGA-3C-AAAU", "TCGA-3C-AALI", "TCGA-3C-AALJ", "TCGA-3C-AALK", "TCGA-4H-AAAK", "TCGA-5L-AAT0")) &&
   all(conv.mat[1:6, 1:8] == cell12))
cell14 <- c(0, 5, 1, 4, 4, 21, 10, 53, 1, 2, 1, 7, 0, 3, 1, 15, 0, 2, 0, 1, 1, 0, 2, 2, 2, 8, 0, 1, 0, 0, 0, 3,
  23, 20, 88, 15, 12, 15, 66, 15, 54, 86, 146, 64, 8, 11, 37, 3, 0, 8, 0, 8, 3, 8, 3, 1, 1, 6, 0, 3, 1, 1, 1, 0,
  21, 20, 41, 8, 18, 14, 53, 19, 59, 26, 43, 38, 14, 18, 20, 9, 0, 1, 1, 2, 0, 3, 8, 4, 0, 0, 2, 1, 0, 2, 0, 0)
ck("cell 14's TCGA-BH-A18G equal in all 96 channels", all(conv.mat["TCGA-BH-A18G", ] == cell14), sprintf("%d SNVs", sum(cell14)))
tot <- rowSums(conv.mat)
q <- quantile(tot, c(0, 0.1, 0.25, 0.5, 0.75, 0.9, 0.99, 1))
cat(sprintf("  SNVs per tumour over %d tumours: %s; total %s\n", length(tot),
    paste(sprintf("%s %g", names(q), q), collapse = ", "), format(sum(tot), big.mark = ",")))
heavy <- head(sort(tot, decreasing = TRUE), 6)
cat("  heaviest: ", paste(sprintf("%s %d (%.1f%%)", names(heavy), as.integer(heavy), 100 * heavy / sum(tot)), collapse = ", "), "\n")
cat(sprintf("  tumours with fewer than 10 SNVs: %d; with none: %d\n", sum(tot < 10), sum(tot == 0)))

# ------------------------------------------------------------------ cell 21
cat("\n§2 cell 21: extractSignatures(n = 5, pConstant = 0.1, parallel = 1)\n")
r <- quietly(extractSignatures(mat = tnm, n = 5, pConstant = 0.1, parallel = 1))
sig.ext <- r$res
cat(paste0("  said: ", r$said[!grepl("Finished", r$said)], collapse = "\n"), "\n")
W <- sig.ext$signatures
cell21.head <- rbind(   # A[C>A]A ... T[C>G]C, the thirty rows printed first
  c(5.083356e-04, 1.246286e-03, 0.020938678, 2.555807e-03, 1.539064e-04), c(1.722520e-03, 9.792774e-04, 0.027773564, 9.424131e-04, 3.284088e-03),
  c(7.198356e-04, 2.733618e-04, 0.008844618, 2.846349e-03, 3.557607e-04), c(7.762949e-03, 3.952875e-08, 0.015376374, 1.209374e-03, 2.904532e-03),
  c(3.324670e-03, 1.586103e-03, 0.023291864, 4.103488e-04, 1.035182e-02), c(1.194906e-03, 1.054688e-03, 0.016335488, 6.530406e-04, 1.684469e-02),
  c(4.471244e-04, 4.297540e-04, 0.009268236, 1.103308e-04, 8.251127e-03), c(1.443095e-02, 2.635059e-04, 0.007026407, 2.631511e-21, 4.793866e-02),
  c(1.537878e-03, 6.047594e-04, 0.022376624, 7.024611e-03, 2.557420e-21), c(2.849609e-03, 1.027972e-03, 0.022436085, 9.450988e-04, 2.391539e-03),
  c(1.230555e-04, 1.832223e-04, 0.008061163, 6.767942e-03, 9.287041e-05), c(8.128482e-03, 4.082166e-04, 0.020036806, 6.015943e-05, 4.654237e-03),
  c(4.007209e-02, 3.175994e-02, 0.016225572, 8.836316e-04, 2.557420e-21), c(1.269111e-02, 1.653154e-02, 0.027770685, 4.116985e-05, 4.360795e-03),
  c(3.428371e-03, 4.013328e-03, 0.009603202, 4.089984e-03, 2.557420e-21), c(2.544242e-01, 3.907214e-03, 0.006341652, 2.631511e-21, 5.943532e-15),
  c(3.490290e-04, 1.711890e-03, 0.015878091, 8.096089e-04, 2.800767e-04), c(1.704788e-04, 1.730787e-03, 0.015320527, 6.007124e-05, 1.414027e-03),
  c(1.150703e-05, 5.966744e-04, 0.011047029, 5.320434e-05, 3.617227e-04), c(1.768250e-04, 2.221990e-03, 0.015544159, 3.347300e-05, 8.295057e-04),
  c(1.192396e-05, 3.574114e-03, 0.015041987, 3.886429e-05, 3.335507e-04), c(1.451760e-05, 6.923007e-04, 0.014947999, 9.039605e-05, 8.054288e-05),
  c(1.716002e-11, 3.104516e-04, 0.012262856, 2.369377e-04, 1.172694e-03), c(1.711881e-04, 3.468901e-03, 0.020164338, 2.936139e-05, 8.624437e-04),
  c(1.857116e-04, 1.173680e-03, 0.011907971, 8.448069e-05, 5.047906e-04), c(1.312606e-04, 9.110800e-04, 0.012754705, 9.099410e-05, 4.675145e-03),
  c(6.609178e-06, 5.632840e-04, 0.007357103, 4.323971e-04, 5.034096e-04), c(1.613731e-04, 1.908797e-03, 0.016012861, 4.890701e-05, 1.835870e-03),
  c(1.095963e-05, 1.484381e-01, 0.009487541, 2.631511e-21, 4.006292e-04), c(1.847983e-04, 4.923859e-02, 0.017816457, 2.631511e-21, 3.222238e-04))
cell21.tail <- rbind(   # A[T>C]G ... T[T>G]T, the thirty rows printed last
  c(1.013407e-03, 2.203522e-04, 1.169905e-02, 3.147378e-03, 3.900973e-02), c(3.749967e-03, 4.040199e-04, 1.609404e-02, 5.593458e-03, 7.869281e-03),
  c(1.209111e-04, 1.084537e-04, 4.732042e-03, 3.174538e-04, 1.819824e-02), c(4.272118e-04, 3.492819e-04, 1.013297e-02, 2.988661e-05, 1.840129e-02),
  c(8.432042e-04, 2.363557e-04, 2.516793e-03, 6.579947e-08, 5.564803e-02), c(2.111670e-03, 5.645313e-04, 1.007894e-02, 3.360615e-05, 1.804655e-02),
  c(6.469524e-03, 2.011304e-21, 2.871924e-05, 8.533888e-04, 4.812316e-02), c(3.953314e-03, 2.011304e-21, 7.154620e-03, 1.369007e-04, 1.899333e-02),
  c(3.679722e-03, 2.344279e-04, 1.741260e-03, 5.806504e-04, 3.621909e-02), c(4.949434e-03, 2.011304e-21, 6.554544e-03, 1.267228e-04, 2.917768e-02),
  c(1.973036e-03, 4.302200e-04, 4.344882e-03, 1.496986e-04, 1.283113e-02), c(4.199424e-03, 4.749026e-04, 9.965813e-03, 6.998563e-05, 1.493717e-02),
  c(2.346941e-03, 2.112627e-04, 4.613111e-03, 1.105016e-04, 1.710502e-02), c(6.082793e-03, 2.151697e-04, 8.545746e-03, 3.221208e-04, 8.899331e-03),
  c(5.551340e-04, 6.138344e-05, 6.380711e-03, 1.454211e-03, 2.531919e-04), c(2.239533e-03, 3.903910e-04, 6.048232e-03, 9.709199e-04, 1.288670e-03),
  c(5.470553e-04, 3.992821e-04, 8.238504e-03, 1.052913e-03, 8.257569e-04), c(6.353618e-03, 5.995814e-05, 6.933157e-03, 2.699034e-04, 1.250633e-03),
  c(1.088118e-03, 3.670604e-05, 6.156648e-03, 9.228144e-04, 9.078967e-05), c(1.003731e-03, 2.077163e-04, 7.468985e-03, 1.246416e-03, 5.351005e-03),
  c(2.777950e-03, 2.998659e-12, 1.061436e-02, 3.581737e-05, 6.419033e-03), c(8.431086e-03, 2.836017e-04, 1.220252e-02, 4.449611e-05, 5.439337e-03),
  c(2.933198e-07, 1.940584e-04, 5.815547e-03, 1.541477e-03, 2.557420e-21), c(1.288558e-03, 1.052392e-04, 6.532226e-03, 4.975142e-04, 1.707661e-03),
  c(3.331329e-04, 4.621810e-05, 9.136140e-03, 1.189827e-04, 1.744720e-03), c(2.225769e-03, 4.729248e-19, 6.349004e-03, 1.147402e-04, 3.382622e-03),
  c(4.581099e-03, 1.719713e-04, 6.130995e-03, 2.776342e-04, 1.677875e-19), c(4.816426e-03, 3.274023e-04, 7.447846e-03, 1.506306e-03, 5.485403e-04),
  c(2.095513e-03, 3.600730e-04, 9.057999e-03, 2.811429e-04, 6.850414e-04), c(3.017964e-02, 2.011304e-21, 8.116204e-03, 4.423500e-05, 3.745681e-04))
printed <- rbind(cell21.head, cell21.tail)
mine <- rbind(W[1:30, ], W[67:96, ])
relOff <- function(a, b) max(abs(a - b) / pmax(abs(b), 1e-12))
rel21 <- max(abs(mine - printed)[printed > 1e-6] / printed[printed > 1e-6])
ck("cell 21's 60 printed rows, all five signatures, to the printed seven digits (entries above 1e-6)", rel21 < 5e-6,
   sprintf("largest relative difference %.1e", rel21))
cat(sprintf("  largest absolute difference over the 60 rows, tiny entries included: %.1e\n", max(abs(mine - printed))))
for (k in 1:5) cat(sprintf("  cosine of Signature_%d to cell 21's printed rows: %.6f\n", k, cosine(mine[, k], printed[, k])))
write.table(data.frame(channel = rownames(W), W, check.names = FALSE), file.path(out, "lesson_sigs.tsv"), sep = "\t", quote = FALSE, row.names = FALSE)
Habs <- sig.ext$contributions_abs
write.table(data.frame(signature = rownames(Habs), Habs, check.names = FALSE), file.path(out, "lesson_expo.tsv"), sep = "\t", quote = FALSE, row.names = FALSE)
write.table(data.frame(tumour = rownames(conv.mat), conv.mat, check.names = FALSE), file.path(out, "tnm.tsv"), sep = "\t", quote = FALSE, row.names = FALSE)
fit <- sig.ext$nmfObj
cat(sprintf("  the run: method %s, %d iterations, seed %s, residual (KL) %.1f\n", algorithm(fit), niter(fit),
    tryCatch(as.character(seeding(fit)), error = function(e) "?"), tryCatch(residuals(fit), error = function(e) NA)))

# ------------------------------------------------------------------ cells 24 and 30
cat("\n§3 cells 24 and 30: compareSignatures against legacy and SBS\n")
leg <- quietly(compareSignatures(nmfRes = sig.ext, sig_db = "legacy"))
sbs <- quietly(compareSignatures(nmfRes = sig.ext, sig_db = "SBS"))
cat(paste0("  legacy said: ", leg$said[grepl("Found|Aetiology", leg$said)], collapse = "\n"), "\n")
cat(paste0("  SBS said: ", sbs$said[grepl("Found|Aetiology", sbs$said)], collapse = "\n"), "\n")
L <- leg$res$cosine_similarities
S <- sbs$res$cosine_similarities
cell24 <- rbind(
  c(0.375, 0.151, 0.164, 0.206, 0.235, 0.250, 0.280, 0.276, 0.251, 0.939),
  c(0.139, 0.848, 0.348, 0.122, 0.211, 0.072, 0.459, 0.151, 0.112, 0.135),
  c(0.361, 0.068, 0.886, 0.775, 0.745, 0.297, 0.197, 0.803, 0.571, 0.138),
  c(0.868, 0.415, 0.267, 0.189, 0.487, 0.788, 0.554, 0.289, 0.227, 0.229),
  c(0.728, 0.023, 0.359, 0.288, 0.627, 0.902, 0.090, 0.379, 0.377, 0.148))
cell24b <- rbind(
  c(0.094, 0.020, 0.061, 0.175, 0.245, 0.115, 0.039, 0.087, 0.261, 0.135),
  c(0.048, 0.016, 0.095, 0.197, 0.214, 0.109, 0.061, 0.034, 0.113, 0.443),
  c(0.236, 0.325, 0.212, 0.663, 0.639, 0.339, 0.177, 0.248, 0.675, 0.348),
  c(0.216, 0.046, 0.484, 0.184, 0.331, 0.259, 0.096, 0.049, 0.281, 0.698),
  c(0.598, 0.086, 0.343, 0.225, 0.440, 0.705, 0.099, 0.136, 0.345, 0.338))
ck("cell 24's printed cosines (COSMIC_1–10 and 21–30), all five rows", all(abs(L[, 1:10] - cell24) < 1e-9) && all(abs(L[, 21:30] - cell24b) < 1e-9),
   sprintf("largest difference %.3f", max(abs(L[, 1:10] - cell24), abs(L[, 21:30] - cell24b))))
cell30 <- rbind(
  c(0.255, 0.114, 0.124, 0.191, 0.241, 0.230, 0.199, 0.197, 0.032, 0.044),
  c(0.042, 0.757, 0.275, 0.097, 0.306, 0.079, 0.588, 0.242, 0.076, 0.060),
  c(0.209, 0.021, 0.872, 0.679, 0.654, 0.211, 0.139, 0.255, 0.261, 0.191),
  c(0.765, 0.394, 0.273, 0.112, 0.506, 0.832, 0.510, 0.527, 0.066, 0.107),
  c(0.619, 0.007, 0.410, 0.246, 0.582, 0.797, 0.046, 0.110, 0.093, 0.226))
ck("cell 30's printed cosines (SBS1 … SBS7d), all five rows", all(abs(S[, 1:10] - cell30) < 1e-9),
   sprintf("largest difference %.3f", max(abs(S[, 1:10] - cell30))))
for (db in c("legacy", "SBS")) {
  x <- readRDS(system.file("extdata", paste0(db, "_signatures.RDs"), package = "maftools"))
  write.table(data.frame(channel = rownames(x$db), x$db, check.names = FALSE), file.path(out, paste0("ref_", db, ".tsv")), sep = "\t", quote = FALSE, row.names = FALSE)
  write.table(data.frame(signature = rownames(x$aetiology), x$aetiology, check.names = FALSE), file.path(out, paste0("aet_", db, ".tsv")), sep = "\t", quote = FALSE, row.names = FALSE)
}
top3 <- function(M, i) { o <- order(-M[i, ])[1:4]; paste(sprintf("%s %.3f", colnames(M)[o], M[i, o]), collapse = ", ") }
for (i in 1:5) cat(sprintf("  Signature_%d  legacy: %s\n               SBS:    %s\n", i, top3(L, i), top3(S, i)))

# ------------------------------------------------------------------ what each signature is made of
cat("\n§4 what each of cell 21's signatures is made of\n")
V <- t(conv.mat)                      # 96 x 968, as extractSignatures factorises it (before pConstant)
Wabs <- NMF::basis(fit); Habs0 <- NMF::coef(fit)
for (k in 1:5) {
  held <- Wabs[, k] %o% Habs0[k, ]    # the mutations this signature explains in each tumour (96 x 968)
  byT <- colSums(held)
  o <- order(-byT)
  sh <- byT / sum(byT)
  prof <- W[, k]
  nearT <- sapply(seq_len(ncol(V)), function(j) if (sum(V[, j]) > 0) cosine(prof, V[, j]) else NA)
  best <- which.max(nearT)
  cat(sprintf("  Signature_%d: %.0f mutations explained (%.1f%% of the fit); largest holders %s; tumours holding half: %d; nearest tumour %s at cosine %.3f (%d SNVs)\n",
      k, sum(byT), 100 * sum(byT) / sum(Wabs %*% Habs0), paste(sprintf("%s %.1f%%", colnames(V)[o[1:3]], 100 * sh[o[1:3]]), collapse = ", "),
      which(cumsum(sort(sh, decreasing = TRUE)) >= 0.5)[1], colnames(V)[best], nearT[best], sum(V[, best])))
  topc <- order(-prof)[1:3]
  cat(sprintf("    largest channels %s; cosine to a flat profile %.3f\n",
      paste(sprintf("%s %.3f", rownames(W)[topc], prof[topc]), collapse = ", "), cosine(prof, rep(1, 96))))
}
cat(sprintf("  the pseudo-count: pConstant 0.1 in each of %d cells adds %.0f to the matrix's %s mutations (%.1f%%); for the median tumour (%g SNVs) it is %.1f of %.1f\n",
    length(V), 0.1 * length(V), format(sum(V), big.mark = ","), 100 * 0.1 * length(V) / sum(V), median(colSums(V)), 9.6, median(colSums(V)) + 9.6))

# ------------------------------------------------------------------ the same extraction without one tumour
cat("\n§5 the same call with TCGA-AN-A046 left out, and with TCGA-AC-A23H left out as well\n")
for (drop in list("TCGA-AN-A046", c("TCGA-AN-A046", "TCGA-AC-A23H"))) {
  t2 <- list(nmf_matrix = conv.mat[!rownames(conv.mat) %in% drop, ])
  s2 <- quietly(extractSignatures(mat = t2, n = 5, pConstant = 0.1, parallel = 1))$res
  W2 <- s2$signatures
  l2 <- quietly(compareSignatures(nmfRes = s2, sig_db = "legacy"))$res$cosine_similarities
  b2 <- quietly(compareSignatures(nmfRes = s2, sig_db = "SBS"))$res$cosine_similarities
  cat(sprintf("  without %s (%d tumours):\n", paste(drop, collapse = " and "), nrow(t2$nmf_matrix)))
  for (k in 1:5) {
    cs <- sapply(1:5, function(j) cosine(W2[, k], W[, j]))
    cat(sprintf("    Signature_%d: nearest of the lesson's is Signature_%d at %.3f; best legacy %s %.3f, best SBS %s %.3f; cosine to TCGA-AN-A046 %.3f\n",
        k, which.max(cs), max(cs), colnames(l2)[which.max(l2[k, ])], max(l2[k, ]), colnames(b2)[which.max(b2[k, ])], max(b2[k, ]),
        cosine(W2[, k], conv.mat["TCGA-AN-A046", ])))
  }
  cat(sprintf("    closest any signature comes to the lesson's Signature_1: %.3f\n", max(sapply(1:5, function(k) cosine(W2[, k], W[, 1])))))
}

# ------------------------------------------------------------------ the pseudo-count
cat("\n§6 the same call at other pConstant values (every tumour in)\n")
for (pc in c(0.001, 0.01, 1)) {
  s3 <- quietly(extractSignatures(mat = tnm, n = 5, pConstant = pc, parallel = 1))$res
  W3 <- s3$signatures
  l3 <- quietly(compareSignatures(nmfRes = s3, sig_db = "legacy"))$res$cosine_similarities
  cat(sprintf("  pConstant %g:\n", pc))
  for (k in 1:5) {
    cs <- sapply(1:5, function(j) cosine(W3[, k], W[, j]))
    cat(sprintf("    Signature_%d: nearest lesson signature %d at %.3f; flat %.3f; best legacy %s %.3f\n", k, which.max(cs), max(cs),
        cosine(W3[, k], rep(1, 96)), colnames(l3)[which.max(l3[k, ])], max(l3[k, ])))
  }
}

cat(sprintf("\n%d checks, %d failed\n", checks, failed))
