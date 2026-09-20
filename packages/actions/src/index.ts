import { PLACEHOLDER as ENGINE_PLACEHOLDER } from "@siftline/core";

/**
 * Folds in the engine's placeholder so the caret dependency on `@siftline/core` is
 * exercised at runtime, not merely declared.
 */
export const PLACEHOLDER = `siftline-actions-walking-skeleton(${ENGINE_PLACEHOLDER})`;
