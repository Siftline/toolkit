import { VERSION as ENGINE_VERSION } from "@siftline/core";

import packageJson from "../package.json" with { type: "json" };

/** The published version of `@siftline/cli`, baked in at build time. */
export const VERSION: string = packageJson.version;

export const USAGE: string = [
  `siftline ${VERSION} (engine ${ENGINE_VERSION})`,
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
].join("\n");
