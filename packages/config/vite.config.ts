import { defineConfig } from "vite-plus";

// Consumed just-in-time from source: nothing to build or test, only to lint and typecheck.
export default defineConfig({
  run: {
    tasks: {
      lint: "vp lint --type-aware --deny-warnings",
      typecheck: "tsc --noEmit",
    },
  },
});
