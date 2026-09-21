import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import type { RunDeps } from "@siftline/cli";
import { serializeFixture } from "@siftline/core";
import type { EntryType, Fixture, SystemOneClient } from "@siftline/core";
import { parseReplayLines } from "@siftline/core/testing";
import type { ReplayLine } from "@siftline/core/testing";

// Test-only. The corpus is core's, reached by relative path: moving it breaks this file.
const coreFixtures = new URL("../../core/fixtures/", import.meta.url);

export const RECIPE_PATH: string = fileURLToPath(
  new URL("recipes/support-inbox.json", coreFixtures),
);

export const recordings: ReplayLine[] = parseReplayLines(
  readFileSync(new URL("replay/support-inbox.jsonl", coreFixtures), "utf8"),
);

const probes: ReplayLine[] = parseReplayLines(
  readFileSync(new URL("replay/probes.jsonl", coreFixtures), "utf8"),
);

/** A recorded SDK failure, rebuilt the way the replay client rebuilds one. */
export function recordedError(id: string): Error {
  const line = probes.find((recorded) => recorded.id === id);
  if (!line || !("error" in line)) throw new Error(`no recorded error ${id}`);
  const { name, message, status, retryAfterMs, body } = line.error;
  return Object.assign(new Error(message), { name, status, retryAfterMs, body });
}

export function stateOf(recordId: string): EntryType {
  const line = recordings.find((recorded) => recorded.id === `support-inbox/${recordId}`);
  if (!line) throw new Error(`no recording ${recordId}`);
  return line.request.state;
}

/** The spec's five Fixtures: `fixture:4` asserts `complaint` where si-04 answers `question`. */
export const WORKED_FIXTURES: Fixture[] = [
  { state: stateOf("si-01"), expect: { category: "complaint", wants_human: true } },
  { state: stateOf("si-02"), expect: { category: "question", wants_human: false } },
  { state: stateOf("si-03"), expect: { category: "other", wants_human: false } },
  { state: stateOf("si-04"), expect: { category: "complaint", wants_human: false } },
  { state: stateOf("si-05"), expect: { category: "other", wants_human: false } },
];

export function fixturesFile(fixtures: readonly Fixture[]): string {
  return textFile(fixtures.map(serializeFixture).join("\n"), "fixtures.jsonl");
}

export function textFile(contents: string, name: string): string {
  const path = join(mkdtempSync(join(tmpdir(), "siftline-cli-")), name);
  writeFileSync(path, contents, "utf8");
  return path;
}

/** The string streams the CLI is driven through, plus what each one collected. */
export interface Harness {
  deps: RunDeps;
  stdout: () => string;
  stderr: () => string;
}

export function harness(
  client: SystemOneClient,
  env: { readonly [name: string]: string | undefined } = { TYPESAFE_API_KEY: "test-key" },
): Harness {
  const out: string[] = [];
  const err: string[] = [];

  return {
    deps: {
      client,
      stdin: emptyStdin(),
      stdout: {
        write: (chunk: string) => {
          out.push(chunk);
        },
      },
      stderr: {
        write: (chunk: string) => {
          err.push(chunk);
        },
      },
      env,
    },
    stdout: () => out.join(""),
    stderr: () => err.join(""),
  };
}

async function* emptyStdin(): AsyncGenerator<string> {
  // `test` never reads stdin; `label` will.
}
