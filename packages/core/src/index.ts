import packageJson from "../package.json" with { type: "json" };

/** The published version of `@siftline/core`, baked in at build time. */
export const VERSION: string = packageJson.version;

/** Walking-skeleton export. Deleted when the first recipe lands — do not depend on it. */
export const PLACEHOLDER = "siftline-core-walking-skeleton";
