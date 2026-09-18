import { defineVitestConfig } from "@siftline/config/vitest";

// `test:live` owns the live suite through its own config; the default run never picks it up.
export default defineVitestConfig({ exclude: ["src/**/*.live.test.ts"] });
