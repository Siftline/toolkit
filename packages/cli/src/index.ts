import { SiftlineError } from "@siftline/core";

import type { RunDeps } from "./deps";
import { InputError, UsageError, writeLine } from "./deps";
import { runLabel } from "./label";
import { requireApiKey } from "./options";
import { runTest } from "./test";
import { USAGE, VERSION } from "./usage";

export type { InputStream, OutputStream, RunDeps } from "./deps";
export { API_KEY_ENV } from "./options";
export { USAGE, VERSION } from "./usage";

/**
 * The library door. Every command runs through it, so a test drives the whole CLI with an
 * injected client and string streams and asserts on the exit code and what was written.
 */
export async function run(argv: readonly string[], deps: RunDeps): Promise<number> {
  try {
    if (argv.includes("--help")) {
      writeLine(deps.stdout, USAGE);
      return 0;
    }
    if (argv.includes("--version")) {
      writeLine(deps.stdout, VERSION);
      return 0;
    }

    const [command, ...rest] = argv;
    if (command === undefined) throw new UsageError("no command given");
    if (command !== "test" && command !== "label") {
      throw new UsageError(`unknown command: ${command}`);
    }

    requireApiKey(deps.env);

    return command === "label" ? await runLabel(rest, deps) : await runTest(rest, deps);
  } catch (error) {
    return exitFor(error, deps);
  }
}

/** Every failure's exit code and its one stderr line. */
function exitFor(error: unknown, deps: RunDeps): number {
  if (deps.signal?.aborted) {
    writeLine(deps.stderr, "siftline: interrupted");
    return 130;
  }

  if (error instanceof UsageError) {
    writeLine(deps.stderr, `siftline: ${error.message}\n\n${USAGE}`);
    return 2;
  }

  if (error instanceof InputError) {
    writeLine(deps.stderr, `siftline: ${error.message}`);
    return 2;
  }

  if (error instanceof SiftlineError) {
    writeLine(deps.stderr, `siftline: ${error.message}`);
    return error.code === "fixture_invalid" ? 2 : 1;
  }

  writeLine(deps.stderr, `siftline: ${error instanceof Error ? error.message : String(error)}`);
  return 1;
}
