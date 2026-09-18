import { PLACEHOLDER, VERSION } from "@siftline/core";
import { createFakeTypeSafeClient } from "@siftline/core/testing";
import { expect, it } from "vitest";

// Imported by package name, not by relative path: this asserts the published
// `exports` map the way a consumer meets it.

it("exposes the placeholder export from the package root", () => {
  expect(PLACEHOLDER).toBe("siftline-core-walking-skeleton");
});

it("reports the package version", () => {
  expect(VERSION).toMatch(/^\d+\.\d+\.\d+/);
});

it("exposes the fake client from the testing entry", () => {
  expect(createFakeTypeSafeClient().kind).toBe("fake");
});
