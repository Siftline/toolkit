import { VERSION as CORE_VERSION } from "@siftline/core";

/**
 * Folds in the engine's version so the caret dependency on `@siftline/core` is exercised at
 * runtime, not merely declared.
 */
export const PLACEHOLDER = `siftline-actions-walking-skeleton(@siftline/core@${CORE_VERSION})`;
