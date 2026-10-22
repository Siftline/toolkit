import { defineLibraryConfig } from "@siftline/config/tsdown";
import { defineConfig } from "vite-plus";

// Every workspace package this one depends on, built first.
const dependencyBuilds = { task: "build", from: ["dependencies", "devDependencies"] } satisfies {
  task: string;
  from: ("dependencies" | "devDependencies")[];
};

// `mode` is "test" under Vitest unless `--mode` says otherwise.
export default defineConfig(({ mode }) => ({
  test: {
    // Vitest v4 compatibility: preserve mock call history.
    // Remove after tests no longer rely on calls from setup or earlier tests.
    // https://viteplus.dev/guide/vitest-v5#remove-unneeded-compatibility-settings
    // https://vitest.dev/guide/migration/#clearmocks-is-enabled-by-default
    clearMocks: false,
    globals: false,
    // Real TypeSafe calls, billed, live in `*.live.test.ts`. Only `test:live`
    // (`--mode live`) runs them; `live.yml` does, on demand.
    ...(mode === "live"
      ? { include: ["src/**/*.live.test.ts"] }
      : { include: ["src/**/*.test.ts"], exclude: ["src/**/*.live.test.ts"] }),
  },
  pack: defineLibraryConfig(["src/index.ts", "src/testing.ts"]),
  run: {
    tasks: {
      build: {
        command: "vp pack",
        dependsOn: [dependencyBuilds],
      },
      lint: {
        command: "vp lint --type-aware --deny-warnings",
        dependsOn: [dependencyBuilds],
      },
      typecheck: {
        command: "tsc --noEmit",
        dependsOn: [dependencyBuilds],
      },
      // The tests import this package by name, so they run against its own build.
      test: {
        command: "vp test run",
        dependsOn: [dependencyBuilds, "build"],
      },
    },
  },
}));
