import { defineConfig } from "vite-plus";

// Real TypeSafe calls, billed. Turborepo never runs this; `live.yml` does, on demand.
export default defineConfig({
  test: {
    // Vitest v4 compatibility: preserve mock call history.
    // Remove after tests no longer rely on calls from setup or earlier tests.
    // https://viteplus.dev/guide/vitest-v5#remove-unneeded-compatibility-settings
    // https://vitest.dev/guide/migration/#clearmocks-is-enabled-by-default
    clearMocks: false,
    globals: false,
    include: ["src/**/*.live.test.ts"],
  },
});
