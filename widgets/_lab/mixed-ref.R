# Regenerates 05-07's two simulated datasets EXACTLY (base R, no packages),
# proves the regeneration against the notebook's stored head/tail rows, fits
# the lm halves, and dumps everything to mixed-ref.json for mixed-measure.mjs.
#
# Why base R when the notebook is tidyverse: mutate() evaluates its arguments
# sequentially, so the RNG stream is just the six calls below in this order.
# lme4 fits are appended by this same script WHEN lme4 is installed; until
# then the notebook's stored lmer table (cell 13) is the LMM target, which is
# lme4's own answer on this exact data.
#
# Run:  Rscript widgets/_lab/mixed-ref.R   (writes widgets/_lab/mixed-ref.json)

stopifnot(getRversion() >= "3.6.0")  # sample() rejection sampling

out <- list()

## ---- Example 1: longitudinal BP (notebook cells 5-13) ----------------------
set.seed(123)
num_patients <- 100
mpp <- 5

# expand.grid(patient_id = 1:100, time_point = 1:5): patient cycles fastest
patient_id <- rep(1:num_patients, times = mpp)
time_point <- rep(1:mpp, each = num_patients)

age_p    <- round(runif(num_patients, 40, 60))
gender_p <- sample(c("Male", "Female"), num_patients, replace = TRUE)
med_p    <- sample(c("Yes", "No"), num_patients, replace = TRUE)
u0_p     <- rnorm(num_patients, mean = 0, sd = 10)
u1_p     <- rnorm(num_patients, mean = -1, sd = 0.5)
eps      <- rnorm(num_patients * mpp, mean = 0, sd = 5)

age    <- age_p[patient_id]
gender <- gender_p[patient_id]
medication <- med_p[patient_id]
bp <- 120 + (age - 50) * 0.75 + ifelse(gender == "Male", 5, 0) +
      u0_p[patient_id] + time_point * u1_p[patient_id] + eps

# Prove the regeneration against the notebook's stored rows (head/tail cells)
chk <- function(label, got, want, tol = 5e-5) {
  ok <- if (is.numeric(got)) all(abs(got - want) < tol) else all(got == want)
  cat(sprintf("%-46s %s\n", label, if (ok) "OK" else "MISMATCH"))
  if (!ok) { print(got); print(want); quit(status = 1) }
}
chk("bp head rows 1-6", round(bp[1:6], 4),
    c(133.7643, 120.9457, 118.5137, 120.5447, 120.8887, 111.0713))
chk("bp tail rows 495-500", round(bp[495:500], 4),
    c(113.3285, 130.0104, 120.5207, 99.1985, 118.2450, 119.2564))
chk("age head", age[1:6], c(46, 56, 48, 58, 59, 41))
chk("gender head", gender[1:6], c("Male","Female","Female","Male","Female","Female"))
chk("medication head", medication[1:6], c("No","No","No","Yes","No","No"))

bpdat <- data.frame(patient_id, time_point, blood_pressure = bp,
                    age, gender, medication)

lm1 <- lm(blood_pressure ~ age + gender + medication, data = bpdat)
ci1 <- confint(lm1)
chk("lm coefs vs notebook cell 10", round(unname(coef(lm1)), 3),
    c(81.261, 0.747, 6.006, -3.403))
chk("lm CI (medicationYes) vs cell 10", round(unname(ci1["medicationYes", ]), 3),
    c(-5.309, -1.497))
chk("lm R2 vs cell 10", round(summary(lm1)$r.squared, 3), 0.225)

out$bp <- list(
  data = bpdat,
  lm = list(coef = coef(lm1), ci = ci1,
            r2 = summary(lm1)$r.squared,
            rmse = sqrt(mean(residuals(lm1)^2)),
            sigma = summary(lm1)$sigma),
  # lme4 target from the notebook's own stored output (cell 13), REML=TRUE,
  # formula blood_pressure ~ age + gender + medication + (1 + time_point | patient_id)
  lmer_notebook = list(
    coef = c(`(Intercept)` = 81.834, age = 0.743, genderMale = 6.038,
             medicationYes = -3.644),
    ci = list(`(Intercept)` = c(64.450, 99.218), age = c(0.398, 1.088),
              genderMale = c(2.104, 9.971), medicationYes = c(-7.530, 0.242)),
    sd_intercept = 9.918, sd_slope = 1.164, cor = -0.255, sd_resid = 4.978,
    icc = 0.8, r2_marginal = 0.217, r2_conditional = 0.843,
    aic = 3371.0, bic = 3404.7, rmse = 4.28)
)

## ---- Example 2: SNP panel (notebook cells 16-21) ---------------------------
set.seed(10)
n <- 1000; p <- 10; families <- 200

base_genotype <- matrix(sample(0:1, families * p, replace = TRUE), nrow = families)
family_id <- sample(1:families, n, replace = TRUE)
individual_variation <- matrix(sample(0:1, n * p, replace = TRUE), nrow = n)
genotype <- base_genotype[family_id, ] + individual_variation
genotype[genotype > 1] <- 1

true_snp_index <- 5
genetic_effect <- genotype[, true_snp_index] * 1.2
cholesterol <- 8 + genetic_effect + rnorm(n, 0, 0.5) + rnorm(families, 0, 5)[family_id]

chk("snp head family_id", family_id[1:6], c(104, 116, 86, 41, 107, 126))
chk("snp head cholesterol", round(cholesterol[1:6], 6),
    c(8.539939, 1.839157, 16.308382, 7.562458, 7.534931, 13.880269))
chk("snp head genotype row 1", genotype[1, ], c(0,0,1,1,1,0,1,0,1,0))

snpdat <- data.frame(family_id, cholesterol, genotype)
colnames(snpdat) <- c("family_id", "cholesterol", paste0("SNP", 1:p))

# The notebook's own lm: family_id enters NUMERIC (sim_data_snp never factors
# it) - one slope over the family index. Kept verbatim because the reference
# reproduces the notebook; flagged in the review as a notebook defect.
f_lm <- as.formula(paste("cholesterol ~", paste(paste0("SNP", 1:p), collapse = " + "),
                         "+ family_id"))
lm2 <- lm(f_lm, data = snpdat)
out$snp <- list(
  data = snpdat,
  lm = list(coef = coef(lm2), ci = confint(lm2))
)

## ---- lme4 half, when available ---------------------------------------------
.libPaths(c("C:/Users/Admin/AppData/Local/R/win-library/4.5", .libPaths()))
if (requireNamespace("lme4", quietly = TRUE)) {
  lmm1 <- lme4::lmer(blood_pressure ~ age + gender + medication +
                       (1 + time_point | patient_id), data = bpdat, REML = TRUE)
  vc1 <- as.data.frame(lme4::VarCorr(lmm1))
  se1 <- sqrt(diag(as.matrix(vcov(lmm1))))
  out$bp$lmer <- list(coef = lme4::fixef(lmm1), se = se1,
                      ci = cbind(lme4::fixef(lmm1) - 1.96 * se1,
                                 lme4::fixef(lmm1) + 1.96 * se1),
                      varcorr = vc1, reml = as.numeric(lme4::REMLcrit(lmm1)))
  f_lmm <- as.formula(paste("cholesterol ~",
                            paste(paste0("SNP", 1:p), collapse = " + "),
                            "+ (1 | family_id)"))
  lmm2 <- lme4::lmer(f_lmm, data = snpdat, REML = TRUE)
  vc2 <- as.data.frame(lme4::VarCorr(lmm2))
  se2 <- sqrt(diag(as.matrix(vcov(lmm2))))
  out$snp$lmer <- list(coef = lme4::fixef(lmm2), se = se2,
                       ci = cbind(lme4::fixef(lmm2) - 1.96 * se2,
                                  lme4::fixef(lmm2) + 1.96 * se2),
                       varcorr = vc2, reml = as.numeric(lme4::REMLcrit(lmm2)))
  cat("lme4 fits included\n")
} else {
  cat("lme4 NOT installed - JSON carries lm fits + notebook lmer targets only\n")
}

## ---- dump -------------------------------------------------------------------
# Tiny hand-rolled JSON writer (base R has none); numbers at full precision.
j <- function(x) {
  if (is.list(x) && !is.data.frame(x)) {
    paste0("{", paste(sprintf('"%s":%s', names(x), vapply(x, j, "")), collapse = ","), "}")
  } else if (is.data.frame(x)) {
    paste0("{", paste(sprintf('"%s":%s', names(x), vapply(x, j, "")), collapse = ","), "}")
  } else if (is.matrix(x)) {
    j(as.data.frame(x))
  } else if (is.character(x) || is.factor(x)) {
    paste0("[", paste(sprintf('"%s"', as.character(x)), collapse = ","), "]")
  } else {
    paste0("[", paste(vapply(unname(x), function(v)
      if (is.na(v)) "null" else sprintf("%.17g", v), ""), collapse = ","), "]")
  }
}
path <- file.path(dirname(sub("--file=", "", grep("--file=", commandArgs(FALSE), value = TRUE)[1])),
                  "mixed-ref.json")
writeLines(j(out), path)
cat("wrote", path, "\n")
