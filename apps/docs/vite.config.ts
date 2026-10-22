import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import { fumadocsMdx } from "fumadocs-mdx/vite";
import { nitro } from "nitro/vite";
import { defineConfig, lazyPlugins } from "vite-plus";

export default defineConfig({
  test: {
    // Vitest v4 compatibility: preserve mock call history.
    // Remove after tests no longer rely on calls from setup or earlier tests.
    // https://viteplus.dev/guide/vitest-v5#remove-unneeded-compatibility-settings
    // https://vitest.dev/guide/migration/#clearmocks-is-enabled-by-default
    clearMocks: false,
    globals: false,
    include: ["src/**/*.test.ts", "examples/**/*.test.ts"],
  },
  server: {
    port: 3000,
  },
  // The tests read the built `.output` and run the examples on Node; none of these plugins
  // belongs in that run, and the old standalone Vitest config never loaded them.
  plugins:
    process.env.VITEST === undefined
      ? (lazyPlugins(() => [
          fumadocsMdx(),
          tailwindcss(),
          tanstackStart({
            spa: {
              enabled: true,
              prerender: {
                enabled: true,
                crawlLinks: true,
              },
            },

            pages: [
              {
                path: "/docs",
              },
              {
                path: "/api/search",
              },
              {
                path: "llms-full.txt",
              },
              {
                path: "llms.txt",
              },
            ],
          }),
          react(),
          nitro(),
        ]) ?? [])
      : [],
  resolve: {
    tsconfigPaths: true,
    alias: {
      tslib: "tslib/tslib.es6.js",
    },
  },
});
