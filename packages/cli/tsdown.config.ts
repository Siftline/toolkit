import { defineConfig } from "tsdown";

export default defineConfig({
  // Two entries: the importable module and the shebang bin that wraps it. tsdown's
  // shebang plugin chmods any entry chunk whose first line is `#!`.
  entry: ["src/index.ts", "src/cli.ts"],
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
