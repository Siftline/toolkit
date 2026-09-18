import { defineConfig } from "vitest/config";

// Real TypeSafe calls. Turborepo never runs this; `live.yml` does, on demand.
export default defineConfig({
  test: {
    globals: false,
    include: ["src/**/*.live.test.ts"],
  },
});
