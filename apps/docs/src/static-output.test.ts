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
  "docs/concepts/index.html",
  "docs/guide/write-a-recipe/index.html",
  "docs/guide/from-the-hosted-app/index.html",
  "docs/packages/core/index.html",
  "docs/packages/actions/index.html",
  // Proves the `api` task ran and its output was prerendered like any other page.
  "docs/api/index.html",
  "docs/api/core/functions/defineRecipe/index.html",
  "docs/api/core-testing/functions/createScriptedClient/index.html",
  "docs/api/actions/functions/perform/index.html",
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

  it("generates the API reference from the packages' source", () => {
    // These doc comments only exist in `packages/*/src`, so finding them here proves the
    // whole typedoc chain, not just the file copy.
    expect(read("docs/api/core/functions/defineRecipe/index.html")).toContain("erased");
    expect(read("docs/api/actions/functions/perform/index.html")).toContain("No retries");
  });

  it("links API pages to site URLs, not to .mdx files", () => {
    const page = read("docs/api/core/functions/defineRecipe/index.html");
    expect(page).toContain("/docs/api/core/interfaces/Questions");
    // The GitHub "view source" link legitimately ends in `.mdx`; typedoc's own links must not.
    expect(page).not.toMatch(/href="(?!https:\/\/github\.com)[^"]*\.mdx"/);
  });

  it("includes the verified example output in the guide", () => {
    expect(read("docs/guide/measure-with-fixtures/index.html")).toContain(
      "1 of 5 would go to Review",
    );
  });

  it("indexes the API reference for search", () => {
    expect(read("api/search")).toContain("/docs/api");
  });
});
