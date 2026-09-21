import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const publicDir = fileURLToPath(new URL("../.output/public/", import.meta.url));

function read(relativePath: string): string {
  return readFileSync(join(publicDir, relativePath), "utf8");
}

function patternsOf(assetsIgnore: string): string[] {
  return assetsIgnore
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "" && !line.startsWith("#"));
}

const requiredFiles = [
  "index.html",
  "_shell.html",
  "docs/index.html",
  // Proves the `api` task ran and its output was prerendered like any other page.
  "docs/api/index.html",
  // Extensionless and served without a content type.
  "api/search",
];

describe("static output", () => {
  for (const file of requiredFiles) {
    it(`emits ${file}`, () => {
      expect(read(file).length).toBeGreaterThan(0);
    });
  }

  it("copies the shell to index.html so the SPA fallback exists", () => {
    expect(read("index.html")).toBe(read("_shell.html"));
  });

  it("carries the tracked .assetsignore into the uploaded directory unchanged", () => {
    // Asserted against the tracked file, never a copy: `public/.assetsignore` is the
    // single source of truth, and `scripts/assert-no-secret-assets.sh` reads the same file.
    const tracked = readFileSync(
      fileURLToPath(new URL("../public/.assetsignore", import.meta.url)),
      "utf8",
    );

    expect(read(".assetsignore")).toBe(tracked);
    expect(patternsOf(tracked).length).toBeGreaterThan(0);
  });

  it("prerenders page content, not just the shell", () => {
    expect(read("docs/index.html")).toContain("@siftline/core");
  });

  it("generates the API reference from core's source", () => {
    // `serializeRecipe` only exists in `packages/core/src`, so finding it here proves the
    // whole typedoc chain, not just the file copy.
    expect(read("docs/api/index.html")).toContain("serializeRecipe");
  });

  it("indexes the API reference for search", () => {
    expect(read("api/search")).toContain("/docs/api");
  });
});
