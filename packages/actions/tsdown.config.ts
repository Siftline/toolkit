import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  platform: "node",
  // Explicit so config discovery never walks up to the repo root.
  tsconfig: "./tsconfig.json",
  // Pinned rather than auto-selected from install state: every published .d.mts
  // comes from the TypeScript 7 binary (ADR 0004).
  dts: { generator: "tsgo" },
  fixedExtension: true,
  publint: true,
  attw: true,
  clean: true,
  unbundle: false,
});
