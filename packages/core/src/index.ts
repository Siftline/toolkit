import packageJson from "../package.json" with { type: "json" };

/**
 * The published version of `@siftline/core`, baked in at build time.
 *
 * Changesets bumps `package.json`; this constant follows it without a second edit.
 */
export const VERSION: string = packageJson.version;

/**
 * Walking-skeleton export. It exists so the build, type, test, pack and publish path
 * can be proven before any Engine behaviour is written, and it will be deleted when
 * the first recipe lands.
 */
export const PLACEHOLDER = "siftline-core-walking-skeleton";
