import { defineConfig, type ViteUserConfig } from "vitest/config";

export function defineVitestConfig(overrides: ViteUserConfig["test"] = {}): ViteUserConfig {
  return defineConfig({
    test: {
      globals: false,
      include: ["src/**/*.test.ts"],
      ...overrides,
    },
  });
}
