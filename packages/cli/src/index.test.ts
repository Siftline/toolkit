import { run, USAGE, VERSION } from "@siftline/cli";
import { expect, it } from "vitest";

// Imported by package name, not by relative path: this asserts the published `exports`
// map the way a consumer meets it. `cli.test.ts` is the other half — it spawns the `bin`
// the same consumer gets on their PATH.

it("exposes the version from the package root", () => {
  expect(VERSION).toMatch(/^\d+\.\d+\.\d+/);
});

it("exposes the usage block naming the not-yet-implemented commands", () => {
  expect(USAGE).toContain("siftline <command> [options]");
  expect(USAGE).toContain("test     Measure a recipe against its fixtures (not yet implemented)");
  expect(USAGE).toContain("label    Label inputs with a recipe (not yet implemented)");
});

it("exposes the argument parser, which is what the bin is a wrapper around", () => {
  expect(run(["--version"])).toEqual({ code: 0, stdout: `${VERSION}\n`, stderr: "" });
  expect(run([]).code).toBe(1);
});
