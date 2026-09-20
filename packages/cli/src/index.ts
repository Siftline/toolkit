import { VERSION as ENGINE_VERSION } from "@siftline/core";

import packageJson from "../package.json" with { type: "json" };

/** The published version of `@siftline/cli`, baked in at build time. */
export const VERSION: string = packageJson.version;

export const USAGE: string = [
  `siftline ${VERSION} (engine ${ENGINE_VERSION})`,
  "",
  "Usage",
  "  siftline <command> [options]",
  "",
  "Commands",
  "  test     Measure a recipe against its fixtures (not yet implemented)",
  "  label    Label inputs with a recipe (not yet implemented)",
  "",
  "Options",
  "  --help     Print this help and exit",
  "  --version  Print the version and exit",
].join("\n");

export interface CliResult {
  readonly code: 0 | 1;
  readonly stdout: string;
  readonly stderr: string;
}

/** Pure on purpose: the bin is the only place that touches the process. */
export function run(argv: readonly string[]): CliResult {
  const [first, ...rest] = argv;

  if (rest.length === 0 && first === "--version") {
    return { code: 0, stdout: `${VERSION}\n`, stderr: "" };
  }

  if (rest.length === 0 && first === "--help") {
    return { code: 0, stdout: `${USAGE}\n`, stderr: "" };
  }

  const reason = first === undefined ? "no command given" : `unknown command: ${argv.join(" ")}`;

  return { code: 1, stdout: "", stderr: `siftline: ${reason}\n\n${USAGE}\n` };
}
