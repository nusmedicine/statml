# Slot 99, his question 2026-10-10 "why only latent variable 1 on TCGA UCEC?":
# the three pairs of 03 cell 13 at ncomp = 3 — per latent variable, cor(t, u),
# each block's share of variance (mixOmics' explained_variance), and how far
# the subtypes separate on t (eta², between-subtype share of t's variance).
suppressPackageStartupMessages(library(mixOmics))
here <- dirname(normalizePath(sub("^--file=", "", grep("^--file=", commandArgs(FALSE), value = TRUE)[1])))
nbdir <- normalizePath(file.path(here, "../../../jupyterbook/phm5003/notebook/10 - Multi-omics Analysis"))
rd <- function(f) read.delim(file.path(nbdir, f), header = TRUE, row.names = 1, check.names = FALSE)
meta <- read.delim(file.path(nbdir, "meta.data.all.tsv"), header = TRUE, check.names = FALSE)
tr <- meta[meta$set == "training", ]
X <- list(mRNA = t(rd("mrna_data_all.tsv")[, tr$SAMPLE_ID]), meth = t(rd("meth_data_all.tsv")[, tr$SAMPLE_ID]),
          rppa = t(rd("rppa_data_all.tsv")[, tr$SAMPLE_ID]))
g <- factor(tr$SUBTYPE)
eta <- function(t) summary(lm(t ~ g))$r.squared
for (ab in list(c("mRNA", "meth"), c("mRNA", "rppa"), c("meth", "rppa"))) {
  r <- pls(X[[ab[1]]], X[[ab[2]]], ncomp = 3)
  for (k in 1:3) {
    t <- r$variates$X[, k]; u <- r$variates$Y[, k]
    cat(sprintf("%s-%s LV%d  cor(t,u) %.2f  expl %s %.1f%% %s %.1f%%  eta2 t %.2f u %.2f  top subtype means t: %s\n",
      ab[1], ab[2], k, abs(cor(t, u)), ab[1], 100 * r$prop_expl_var$X[k], ab[2], 100 * r$prop_expl_var$Y[k], eta(t), eta(u),
      paste(sprintf("%s %.2f", levels(g), tapply(scale(t), g, mean) * sign(cor(t, u))), collapse = ", ")))
  }
}
