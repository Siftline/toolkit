import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

/**
 * The docs site is deployed as static assets with no Worker code, so the only contract that
 * matters is the shape of `.output/public`. `test` depends on this package's own `build`
 * (see `turbo.json`), so the directory is always freshly built when this runs.
 */
const publicDir = fileURLToPath(new URL("../.output/public/", import.meta.url));

function read(relativePath: string): string {
  return readFileSync(join(publicDir, relativePath), "utf8");
}

/** The patterns wrangler will act on: every line of `.assetsignore` that is not a comment. */
function patternsOf(assetsIgnore: string): string[] {
  return assetsIgnore
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "" && !line.startsWith("#"));
}

const requiredFiles = [
  // The SPA fallback Cloudflare serves for any route that was not prerendered.
  "index.html",
  // TanStack Start's shell, which the build copies to `index.html`.
  "_shell.html",
  // A prerendered docs page, proving the crawl reached the content.
  "docs/index.html",
  // The typedoc-generated API reference, proving the `api` task ran and its output was
  // picked up by fumadocs-mdx and then prerendered like any hand-written page.
  "docs/api/index.html",
  // The static Orama index, extensionless and served without a content type.
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
    // Asserted against the tracked file rather than against a copy of its contents:
    // `public/.assetsignore` is the single source of truth for what must never be
    // uploaded, and `scripts/assert-no-secret-assets.sh` reads the same file. Adding a
    // pattern there needs no edit here.
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
    // The symbol only exists in `packages/core/src/index.ts`, so finding it here proves the
    // whole typedoc chain, not just the file copy.
    expect(read("docs/api/index.html")).toContain("PLACEHOLDER");
  });

  it("indexes the API reference for search", () => {
    expect(read("api/search")).toContain("/docs/api");
  });
});
