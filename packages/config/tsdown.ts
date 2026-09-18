import { defineConfig, type UserConfig } from "tsdown";

/**
 * The build every published package shares: ESM only, bundled for Node, with `publint`
 * and are-the-types-wrong run as part of `build` so a broken `exports` map fails here
 * rather than on npm. `fixedExtension` is what makes the output `.mjs`/`.d.mts`.
 *
 * `dts.generator` is pinned to `tsgo` rather than auto-selected from install state: every
 * published `.d.mts` comes from the TypeScript 7 binary (ADR 0004), and no future change
 * to what happens to be installed can quietly move declaration emit onto the JS compiler
 * API. `build` still passes `--noCheck`, so it is not a typecheck — `typecheck` is its
 * sibling in the Turborepo graph, never its parent.
 *
 * @param entry - the package's entry points, the one thing that differs between packages.
 */
export function defineLibraryConfig(entry: string[]): UserConfig {
  return defineConfig({
    entry,
    format: ["esm"],
    platform: "node",
    // Explicit so config discovery never walks up to the repo root.
    tsconfig: "./tsconfig.json",
    dts: { generator: "tsgo" },
    fixedExtension: true,
    publint: true,
    attw: true,
    clean: true,
    unbundle: false,
  });
}
