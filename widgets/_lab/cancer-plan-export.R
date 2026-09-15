# Planning export for the cancer mutation arc (PHM5003 07). Base R only: this
# machine's R 4.5.2 has no maftools, NMF or mclust, and none is needed to read
# the lesson's own data frames out of their .rda files.
#
#   Rscript widgets/_lab/cancer-plan-export.R "<07 - Cancer Mutation Analysis dir>" <out dir>
#
# writes <out>/maf_cols.tsv (brca_maf.rda, 01-1 cell 9: 89,568 rows) and
# <out>/clin_cols.tsv (brca_clinical.rda, 01-1 cell 18), which
# cancer-plan-measure.mjs reads. Neither file belongs in the repo.
args <- commandArgs(trailingOnly = TRUE)
if (length(args) != 2) stop("usage: Rscript cancer-plan-export.R <lesson dir> <out dir>")
src <- args[1]
out <- args[2]

load(file.path(src, "brca_maf.rda"))        # -> mutation
mcols <- c("Tumor_Sample_Barcode", "Hugo_Symbol", "Variant_Classification", "Variant_Type",
           "HGVSp_Short", "Protein_position", "Chromosome", "Start_Position",
           "Reference_Allele", "Tumor_Seq_Allele2", "CONTEXT",
           "t_depth", "t_ref_count", "t_alt_count", "n_depth", "hotspot")
m <- as.data.frame(mutation)[, intersect(mcols, colnames(mutation))]
write.table(m, file.path(out, "maf_cols.tsv"), sep = "\t", quote = FALSE, row.names = FALSE, na = "")
cat("maf_cols.tsv:", nrow(m), "rows\n")

load(file.path(src, "brca_clinical.rda"))   # -> clinical
ccols <- c("Tumor_Sample_Barcode", "primary_diagnosis", "vital_status", "days_to_last_follow_up")
cl <- as.data.frame(clinical)[, intersect(ccols, colnames(clinical))]
write.table(cl, file.path(out, "clin_cols.tsv"), sep = "\t", quote = FALSE, row.names = FALSE, na = "")
cat("clin_cols.tsv:", nrow(cl), "rows\n")
