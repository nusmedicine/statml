/* Single import surface for widgets: `import { ... } from "../core/index.js"`. */

export { defineWidget } from "./widget.js";
export { makeRng } from "./rng.js";
export { POPULATIONS, normalPdf, mean, sd, histogram, fmt } from "./stats.js";
export { makePlot, niceTicks, tickFormat, samplePdf, createCanvas, spanningRule } from "./canvas.js";
export { readTokens, resolveTheme, isEmbedded } from "./env.js";
