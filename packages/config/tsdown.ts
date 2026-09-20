import { defineConfig, type UserConfig } from "tsdown";

export function defineLibraryConfig(entry: string[]): UserConfig {
  return defineConfig({
    entry,
    format: ["esm"],
    platform: "node",
    // Explicit so config discovery never walks up to the repo root.
    tsconfig: "./tsconfig.json",
    // Pinned: every published `.d.mts` comes from the TypeScript 7 binary (ADR 0004).
    dts: { generator: "tsgo" },
    fixedExtension: true,
    publint: true,
    attw: true,
    clean: true,
    unbundle: false,
  });
}
