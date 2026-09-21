import { run, USAGE, VERSION } from "@siftline/cli";
import { VERSION as ENGINE_VERSION } from "@siftline/core";
import { createReplayClient } from "@siftline/core/testing";
import { expect, it } from "vitest";

import { harness, RECIPE_PATH } from "./harness";

// Imported by package name, not by relative path: this asserts the published `exports` map.

const noClient = createReplayClient([]);

it("exposes the version from the package root", () => {
  expect(VERSION).toMatch(/^\d+\.\d+\.\d+/);
});

it("carries the spec's usage text", () => {
  const [banner, ...body] = USAGE.split("\n");

  expect(banner).toBe(`siftline ${VERSION} (engine ${ENGINE_VERSION})`);
  expect(body).toEqual([
    "",
    "Usage",
    "  siftline test  <recipe.json> <fixtures.jsonl> [--max-in-flight <n>] [--min-accuracy <ratio>] [--json] [--quiet]",
    "  siftline label <recipe.json> [records.jsonl | -] [--rules <rules.json>] [--max-in-flight <n>] [--quiet]",
    "",
    "Options",
    "  --max-in-flight <n>     Records judged at once (default 8)",
    "  --min-accuracy <ratio>  test: exit 1 when the lowest question accuracy is below this",
    "  --json                  test: print the report as JSON",
    "  --rules <rules.json>    label: select an Action per Decision with these Rules",
    "  --quiet                 Silence progress (never warnings or errors)",
    "  --help                  Print this help and exit",
    "  --version               Print the version and exit",
    "",
    "Environment",
    "  TYPESAFE_API_KEY        Required. Read from the environment only.",
  ]);
});

it("prints the version on stdout and exits 0 for --version", async () => {
  const { deps, stdout, stderr } = harness(noClient);

  await expect(run(["--version"], deps)).resolves.toBe(0);
  expect(stdout()).toBe(`${VERSION}\n`);
  expect(stderr()).toBe("");
});

it("prints the usage block on stdout and exits 0 for --help, key or no key", async () => {
  const { deps, stdout } = harness(noClient, {});

  await expect(run(["test", "--help"], deps)).resolves.toBe(0);
  expect(stdout()).toBe(`${USAGE}\n`);
});

it("exits 2 with the usage block when no command is given", async () => {
  const { deps, stdout, stderr } = harness(noClient);

  await expect(run([], deps)).resolves.toBe(2);
  expect(stdout()).toBe("");
  expect(stderr()).toBe(`siftline: no command given\n\n${USAGE}\n`);
});

it("exits 2 for an unknown command", async () => {
  const { deps, stderr } = harness(noClient);

  await expect(run(["frobnicate"], deps)).resolves.toBe(2);
  expect(stderr()).toContain("siftline: unknown command: frobnicate");
});

it("dispatches label, which reads stdin when given no second positional", async () => {
  const { deps, stdout, stderr } = harness(noClient);

  await expect(run(["label", RECIPE_PATH, "--quiet"], deps)).resolves.toBe(0);
  expect(stdout()).toBe("");
  expect(stderr()).toBe("");
});

it("exits 2 before reading a file when the key is missing, and never prints it", async () => {
  const { deps, stdout, stderr } = harness(noClient, { HOME: "/tmp" });

  await expect(
    run(["test", "/no/such/recipe.json", "/no/such/fixtures.jsonl"], deps),
  ).resolves.toBe(2);
  expect(stderr()).toContain("siftline: TYPESAFE_API_KEY is not set");
  expect(stderr()).not.toContain("/no/such/recipe.json");
  expect(stdout()).toBe("");
});

it("treats a blank key as missing", async () => {
  const { deps, stderr } = harness(noClient, { TYPESAFE_API_KEY: "  " });

  await expect(run(["test", RECIPE_PATH, RECIPE_PATH], deps)).resolves.toBe(2);
  expect(stderr()).toContain("siftline: TYPESAFE_API_KEY is not set");
});

it("keeps the key out of every byte it writes", async () => {
  const secret = "sk-do-not-print-me";
  const { deps, stdout, stderr } = harness(noClient, { TYPESAFE_API_KEY: secret });

  await expect(run(["frobnicate", "--json"], deps)).resolves.toBe(2);
  expect(`${stdout()}${stderr()}`).not.toContain(secret);
});
