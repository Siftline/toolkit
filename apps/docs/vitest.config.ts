import { defineVitestConfig } from "@siftline/config/vitest";

export default defineVitestConfig({
  include: ["src/**/*.test.ts", "examples/**/*.test.ts"],
});
