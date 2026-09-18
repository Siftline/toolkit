import { PLACEHOLDER as ENGINE_PLACEHOLDER } from "@siftline/core";

/**
 * Walking-skeleton export. It exists so the build, type, test, pack and publish path
 * can be proven before any adapter is written, and it will be deleted when the first
 * adapter lands. The engine's own placeholder is folded in so the caret dependency on
 * `@siftline/core` is exercised at runtime, not merely declared.
 */
export const PLACEHOLDER = `siftline-actions-walking-skeleton(${ENGINE_PLACEHOLDER})`;
