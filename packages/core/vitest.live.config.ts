import { defineConfig } from "vitest/config";

// Real TypeSafe calls, billed. Turborepo never runs this; `live.yml` does, on demand.
export default defineConfig({
  test: {
    globals: false,
    include: ["src/**/*.live.test.ts"],
  },
});
