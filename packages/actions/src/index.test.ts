import { PLACEHOLDER } from "@siftline/actions";
import { expect, it } from "vitest";

// Imported by package name, not by relative path: this asserts the published
// `exports` map the way a consumer meets it.

it("exposes the placeholder export from the package root", () => {
  expect(PLACEHOLDER).toBe("siftline-actions-walking-skeleton(siftline-core-walking-skeleton)");
});
