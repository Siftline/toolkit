import { defineVitestConfig } from "@siftline/config/vitest";

export default defineVitestConfig({ exclude: ["src/**/*.live.test.ts"] });
