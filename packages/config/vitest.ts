import { defineConfig, type ViteUserConfig } from "vitest/config";

/**
 * The repo's Vitest settings, in one place (ticket 13): plain Vitest, `globals` off so
 * every `it`/`expect` is imported, tests colocated as `src/**‍/*.test.ts`, no coverage.
 *
 * Consumed just-in-time from source — Vite inlines this file when it bundles a
 * `vitest.config.ts`, because `@siftline/config` is a workspace link and not a real
 * `node_modules` dependency.
 *
 * @param overrides - merged over the shared `test` block; pass only what differs.
 */
export function defineVitestConfig(overrides: ViteUserConfig["test"] = {}): ViteUserConfig {
  return defineConfig({
    test: {
      globals: false,
      include: ["src/**/*.test.ts"],
      ...overrides,
    },
  });
}
