# What the lesson's own MAF says about read depth, for the widget's depth
# options. Base R only, no network: it reads brca_maf.rda in place.
#
#   Rscript widgets/_lab/vaf-depth-check.R "<07 - Cancer Mutation Analysis dir>"
#
# Kenneth asked on 2026-09-16 why the widget offers 31, 88, 161 and 500. It
# matches `_lab/cancer-plan-measure.mjs`, which is where the widget's numbers
# came from: depth is ref + alt (what plotVaf divides), and the first twenty
# maftools FLAG genes are left out, as `rmFlags = 20` does.
args <- commandArgs(trailingOnly = TRUE)
if (length(args) != 1) stop("usage: Rscript vaf-depth-check.R <lesson dir>")
load(file.path(args[1], "brca_maf.rda"))        # -> mutation

FLAGS_20 <- c("TTN", "MUC16", "OBSCN", "AHNAK2", "SYNE1", "FLG", "MUC5B", "DNAH17", "PLEC", "DST",
              "SYNE2", "NEB", "HSPG2", "LAMA5", "AHNAK", "HMCN1", "USH2A", "DNAH11", "MACF1", "MUC17")

m <- as.data.frame(mutation)
m <- m[m$Variant_Classification != "Silent", ]
m <- m[!(m$Hugo_Symbol %in% FLAGS_20), ]
d <- suppressWarnings(as.numeric(m$t_ref_count) + as.numeric(m$t_alt_count))
d <- d[is.finite(d) & d > 0]
cat("non-synonymous mutations outside the FLAG genes, with a depth:", length(d), "\n\n")

qs <- c(0.01, 0.05, 0.10, 0.25, 0.50, 0.75, 0.90, 0.95, 0.975, 0.99, 1.00)
q <- quantile(d, qs)
cat("percentile   depth   is it a widget option?\n")
opts <- c(31, 88, 161, 500)
for (i in seq_along(qs)) {
  hit <- if (any(abs(opts - q[i]) <= 1)) "  <-- OPTION" else ""
  cat(sprintf("  %5.1f%%    %6.0f%s\n", 100 * qs[i], q[i], hit))
}
cat(sprintf("\nmean %.1f   sd %.1f   log-sd %.3f\n", mean(d), sd(d), sd(log(d))))
cat(sprintf("the widget's log-sd, from IQR 49-161: %.3f\n", (log(161) - log(49)) / (2 * 0.6745)))

cat("\nwhere each of the widget's four options sits:\n")
for (o in opts) cat(sprintf("  %4d : the %4.1f-th percentile\n", o, 100 * mean(d <= o)))
cat("\nthe landmarks it does NOT offer:\n")
for (p in c(0.25, 0.90, 0.95)) cat(sprintf("  %4.0f%% : depth %4.0f\n", 100 * p, quantile(d, p)))
