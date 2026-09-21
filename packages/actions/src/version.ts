import packageJson from "../package.json" with { type: "json" };

/** The published version of `@siftline/actions`, baked in at build time. */
export const VERSION: string = packageJson.version;
