import { VERSION } from "@siftline/core";
import { expect, it } from "vitest";

// Imported by package name, not by relative path: this asserts the published `exports` map.

it("reports the package version", () => {
  expect(VERSION).toMatch(/^\d+\.\d+\.\d+/);
});
