import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { expect, it } from "vitest";

import packageJson from "../package.json" with { type: "json" };
import { RECIPE_PATH } from "./harness";

// Resolved through the `bin` field, not a hard-coded path: asserts what npm puts on PATH.
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

it("prints the usage block and exits 0 for --help", () => {
  const result = runBin("--help");

  expect(result.status).toBe(0);
  expect(result.stdout).toContain("siftline test  <recipe.json> <fixtures.jsonl>");
  expect(result.stdout).toContain("siftline label <recipe.json> [records.jsonl | -]");
  expect(result.stdout).toContain("TYPESAFE_API_KEY        Required.");
});

it("exits 2 with usage on stderr when no command is given", () => {
  const result = runBin();

  expect(result.status).toBe(2);
  expect(result.stdout).toBe("");
  expect(result.stderr).toContain("siftline: no command given");
});

it("exits 2 with usage on stderr for an unknown command", () => {
  const result = runBin("frobnicate");

  expect(result.status).toBe(2);
  expect(result.stderr).toContain("siftline: unknown command: frobnicate");
});

it("exits 2 without the key, before it reads a file", () => {
  const result = spawnSync(process.execPath, [binPath, "test", "recipe.json", "fixtures.jsonl"], {
    encoding: "utf8",
    env: { ...process.env, TYPESAFE_API_KEY: "" },
  });

  expect(result.status).toBe(2);
  expect(result.stderr).toContain("siftline: TYPESAFE_API_KEY is not set");
  expect(result.stderr).not.toContain("recipe.json:");
});

it("is executable through its own shebang", () => {
  expect(readFileSync(binPath, "utf8").startsWith("#!/usr/bin/env node")).toBe(true);

  const result = spawnSync(binPath, ["--version"], { encoding: "utf8" });

  expect(result.status).toBe(0);
  expect(result.stdout.trim()).toBe(packageJson.version);
});

// Proves `process.stdin` satisfies `InputStream` and that a lone `-` survives `parseArgs`.
it("reads Records from stdin through the `-` sentinel", () => {
  const result = spawnSync(process.execPath, [binPath, "label", RECIPE_PATH, "-"], {
    encoding: "utf8",
    env: { ...process.env, TYPESAFE_API_KEY: "test-key" },
    input: '{"id":"r1","state":"hi","text":"nope"}\n',
  });

  expect(result.status).toBe(2);
  expect(result.stderr).toContain('stdin line 1 is not a valid Record: Unrecognized key: "text"');
});
