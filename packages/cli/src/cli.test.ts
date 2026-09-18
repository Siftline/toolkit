import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { expect, it } from "vitest";

import packageJson from "../package.json" with { type: "json" };

// Resolved through the `bin` field rather than a hard-coded path, so this also
// asserts that what npm installs onto a consumer's PATH is a real, working file.
const packageRoot = new URL("../", import.meta.url);
const binPath = fileURLToPath(new URL(packageJson.bin.siftline, packageRoot));

function runBin(...args: string[]) {
  return spawnSync(process.execPath, [binPath, ...args], { encoding: "utf8" });
}

it("prints its version and exits 0 for --version", () => {
  const result = runBin("--version");

  expect(result.status).toBe(0);
  expect(result.stdout.trim()).toBe(packageJson.version);
});

it("prints usage naming the unimplemented commands and exits 0 for --help", () => {
  const result = runBin("--help");

  expect(result.status).toBe(0);
  expect(result.stdout).toContain("siftline <command> [options]");
  expect(result.stdout).toContain(
    "test     Measure a recipe against its fixtures (not yet implemented)",
  );
  expect(result.stdout).toContain("label    Label inputs with a recipe (not yet implemented)");
});

it("exits 1 with usage on stderr when no command is given", () => {
  const result = runBin();

  expect(result.status).toBe(1);
  expect(result.stdout).toBe("");
  expect(result.stderr).toContain("siftline: no command given");
});

it("exits 1 with usage on stderr for an unknown command", () => {
  const result = runBin("frobnicate");

  expect(result.status).toBe(1);
  expect(result.stderr).toContain("siftline: unknown command: frobnicate");
});

it("is executable through its own shebang", () => {
  expect(readFileSync(binPath, "utf8").startsWith("#!/usr/bin/env node")).toBe(true);

  const result = spawnSync(binPath, ["--version"], { encoding: "utf8" });

  expect(result.status).toBe(0);
  expect(result.stdout.trim()).toBe(packageJson.version);
});
