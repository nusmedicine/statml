# ============================================================================
# The R side of the hierarchical-clustering engine check.
#
#   node widgets/_lab/hc-verify.mjs --emit   # writes hc-points.csv
#   Rscript widgets/_lab/hc-ref.R            # writes hc-ref.csv
#   node widgets/_lab/hc-verify.mjs          # compares
#
# The points come FROM the JS engine so both sides cluster identical numbers —
# reproducing R's `rnorm` stream in JS is a separate problem and not this one.
# No packages: base `dist`, `hclust` and `cutree` are what the lesson calls.
# ============================================================================

here <- "widgets/_lab"
pts <- read.csv(file.path(here, "hc-points.csv"))

linkages <- c("average", "complete", "ward.D2", "single", "centroid")
distances <- c("euclidean", "manhattan")
ks <- c(2, 3, 4, 5, 6)

# Relabel a partition by order of first appearance, so that JS and R can differ
# in which cluster they call 1 without differing about the grouping.
canonical <- function(v) {
  paste(match(v, unique(v)) - 1L, collapse = ";")
}

out <- list()
for (ci in sort(unique(pts$case))) {
  m <- as.matrix(pts[pts$case == ci, c("x", "y")])
  for (DM in distances) {
  d <- dist(m, method = DM)
  for (L in linkages) {
    # `?hclust`: for "centroid" (and "median") the dissimilarities must be
    # SQUARED Euclidean distances, and the heights come back squared too.
    # Feeding it `d` runs the recurrence on the wrong quantity — R computes it
    # without complaint, and the first two merges even agree, so it looks
    # right. That cost a round here: the JS engine was accused of a bug it did
    # not have. Both conventions are non-monotone (centroid inverts), which is
    # a property of the criterion and not of either implementation.
    h <- if (L == "centroid") {
      hh <- hclust(d^2, method = L)
      hh$height <- sqrt(hh$height)
      hh
    } else {
      hclust(d, method = L)
    }
    out[[length(out) + 1]] <- data.frame(
      case = ci, linkage = L, distance = DM, kind = "height",
      idx = seq_along(h$height) - 1L,
      value = format(h$height, digits = 17)
    )
    out[[length(out) + 1]] <- data.frame(
      case = ci, linkage = L, distance = DM, kind = "cut",
      idx = ks,
      value = sapply(ks, function(k) canonical(cutree(h, k = k)))
    )
  }
  }
}

res <- do.call(rbind, out)
write.csv(res, file.path(here, "hc-ref.csv"), row.names = FALSE, quote = FALSE)
cat(sprintf("wrote hc-ref.csv — %d rows, %d stages x %d linkages x %d distances\n",
            nrow(res), length(unique(pts$case)), length(linkages), length(distances)))
