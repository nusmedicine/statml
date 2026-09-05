/* Single import surface for widgets: `import { ... } from "../core/index.js"`. */

export { defineWidget } from "./widget.js";
export { makeRng } from "./rng.js";
export {
  POPULATIONS, EFFECT_SD, normalPdf, studentTPdf, tCritical, tTailP, Z_CRITICAL_95,
  mean, sd, histogram, fmt, sci, sup, lgamma, nbLogPmf, nbPmf, nbDraw,
} from "./stats.js";
export { makePlot, niceTicks, samplePdf, createCanvas, spanningRule, hitTest } from "./canvas.js";
export { readTokens, resolveTheme, isEmbedded, mathmlRenders } from "./env.js";
export { createPile, barMixFor, binsFor, DOT_R, FLASH_MS } from "./accumulator.js";
