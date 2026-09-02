/* Single import surface for widgets: `import { ... } from "../core/index.js"`. */

export { defineWidget } from "./widget.js";
export { makeRng } from "./rng.js";
export {
  POPULATIONS, EFFECT_SD, normalPdf, studentTPdf, tCritical, tTailP, Z_CRITICAL_95,
  mean, sd, histogram, fmt, sci, sup, lgamma, nbLogPmf, nbPmf, nbDraw,
} from "./stats.js";
export { makePlot, niceTicks, tickFormat, samplePdf, createCanvas, spanningRule, hitTest } from "./canvas.js";
export { readTokens, resolveTheme, isEmbedded, mathmlRenders } from "./env.js";
export {
  createPile, barMixFor, smoothMixFor, niceCeil, binsFor,
  DOT_FROM, DOT_TO, DOT_CEIL, DOT_R, SMOOTH_FROM, SMOOTH_TO, FLASH_MS,
} from "./accumulator.js";
