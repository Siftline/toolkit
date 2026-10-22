import { defineConfig } from "vite-plus";

export default defineConfig({
  staged: {
    "*": "vp check --fix",
  },
  test: {
    // Vitest v4 compatibility: preserve mock call history.
    // Remove after tests no longer rely on calls from setup or earlier tests.
    // https://viteplus.dev/guide/vitest-v5#remove-unneeded-compatibility-settings
    // https://vitest.dev/guide/migration/#clearmocks-is-enabled-by-default
    clearMocks: false,
  },
  fmt: {
    sortImports: true,
    sortTailwindcss: {
      functions: ["cn", "cva"],
      // Must be the stylesheet whose utilities are in the class strings being sorted. Every
      // `className` is in `apps/docs`, whose entry stylesheet pulls in Tailwind and the
      // Fumadocs preset; `packages/ui`'s does not.
      stylesheet: "./apps/docs/src/styles/app.css",
    },
    ignorePatterns: [
      // Byte-for-byte test vectors. `serializeRecipe` is their only writer, and oxfmt
      // collapses the arrays it expands.
      "packages/core/fixtures",
      "apps/docs/content/docs/api",
      "**/routeTree.gen.ts",
      "pnpm-lock.yaml",
      "**/dist",
      "**/.output",
      "**/.wrangler",
      "**/.tanstack",
      "**/.source",
      ".agent/**",
      ".agents/**",
      ".claude/**",
      ".codex/**",
      ".continue/**",
      ".cursor/**",
      ".gemini/**",
      ".opencode/**",
      ".pi/**",
      ".roo/**",
      ".windsurf/**",
      "tools/oxlint/anti-slop/**",
      // vp config rewrites its Vite+ section on every install, unformatted. AGENTS.md is a
      // symlink to CLAUDE.md, so both names are listed.
      "AGENTS.md",
      "CLAUDE.md",
    ],
  },
  lint: {
    plugins: ["typescript", "react", "jsx-a11y", "import", "unicorn", "promise", "vitest"],
    categories: {
      correctness: "error",
      suspicious: "error",
      perf: "warn",
    },
    options: {
      typeAware: true,
    },
    // `node` is load-bearing: `no-global-assign` only treats `process`, `console` and
    // `Buffer` as read-only globals when an `env` declares them.
    env: {
      builtin: true,
      node: true,
    },
    jsPlugins: [
      { name: "anti-slop", specifier: "./tools/oxlint/anti-slop/index.ts" },
      { name: "vite-plus", specifier: "vite-plus/oxlint-plugin" },
    ],
    rules: {
      "oxc/no-accumulating-spread": "error",
      "anti-slop/no-array-filter-map": "error",
      "anti-slop/no-reduce-accumulator-copy": "error",
      "anti-slop/no-chained-type-assertions": "error",
      "anti-slop/no-conditional-empty-object-spread": "error",
      "anti-slop/no-known-value-widening": "error",
      "anti-slop/no-module-mocking": "error",
      "anti-slop/no-object-parameters": "error",
      "anti-slop/no-reflect-apply": "error",
      "anti-slop/no-reflect-get": "error",
      "anti-slop/no-runtime-typeof": "error",
      "anti-slop/no-shape-in-symbol-names": "error",
      "anti-slop/no-unknown-parameters": "error",
      "anti-slop/no-unknown-returns": "error",
      "anti-slop/no-unknown-type-aliases": "error",
      "anti-slop/no-unsafe-dictionary-type": "error",
      "anti-slop/no-widen-then-assert": "error",
      "anti-slop/require-readable-spacing": "error",
      "anti-slop/require-safety-comment-for-type-assertion": "error",
      "vite-plus/prefer-vite-plus-imports": "error",
    },
    ignorePatterns: [
      "**/dist",
      "**/.output",
      "**/.wrangler",
      "**/.tanstack",
      "**/.source",
      "**/routeTree.gen.ts",
      "apps/docs/content/docs/api",
      ".agent/**",
      ".agents/**",
      ".claude/**",
      ".codex/**",
      ".continue/**",
      ".cursor/**",
      ".gemini/**",
      ".opencode/**",
      ".pi/**",
      ".roo/**",
      ".windsurf/**",
      "tools/oxlint/anti-slop/**",
    ],
    overrides: [
      {
        files: ["apps/docs/**", "packages/ui/**"],
        plugins: ["react", "jsx-a11y"],
        rules: {
          // React 19's automatic JSX runtime needs no `React` in scope, but the rule is a
          // correctness rule and fires as soon as the react plugin is on.
          "react/react-in-jsx-scope": "off",
        },
      },
      {
        // `params._splat` is the only way to read a TanStack Router wildcard. In oxlint
        // 1.83.0 `no-underscore-dangle` is `suspicious`, which this file denies — removing
        // this override fails `lint`.
        files: ["apps/docs/**"],
        rules: {
          "no-underscore-dangle": "off",
        },
      },
      {
        files: ["**/*.test.ts", "**/*.test.tsx"],
        plugins: ["vitest"],
      },
    ],
  },
});
