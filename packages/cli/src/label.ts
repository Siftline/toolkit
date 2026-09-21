import { createJudge, JudgeError, routeDecision, serializeDecision } from "@siftline/core";
import type { JudgeErrorReason, Recipe, Record, Rule } from "@siftline/core";

import type { OutputStream, RunDeps } from "./deps";
import { UsageError, writeLine } from "./deps";
import { readRecipeFile, readRecords, readRulesFile } from "./input";
import { parseCommandArgs } from "./options";
import { driftMessage } from "./report";

export async function runLabel(args: readonly string[], deps: RunDeps): Promise<number> {
  const { positionals, options } = parseCommandArgs(args);

  if (options.json) throw new UsageError("label takes no --json");
  if (options.minAccuracy !== null) throw new UsageError("label takes no --min-accuracy");

  const [recipePath, recordsPath] = positionals;
  if (recipePath === undefined) throw new UsageError("label needs a recipe");
  if (positionals.length > 2) {
    throw new UsageError(`label takes at most two positionals, not ${positionals.length}`);
  }

  const recipe = await readRecipeFile(recipePath);
  const rules = options.rules === null ? null : await readRulesFile(options.rules, recipe);
  const records = await readRecords(recordsPath, deps.stdin);

  return await label(records, recipe, rules, deps, options.maxInFlight, options.quiet);
}

async function label(
  records: readonly Record[],
  recipe: Recipe,
  rules: Rule[] | null,
  deps: RunDeps,
  maxInFlight: number,
  quiet: boolean,
): Promise<number> {
  const judge = createJudge({ client: deps.client, retry: "patient", maxInFlight });
  const progress = createProgress(deps.stderr, records.length, quiet);

  // A Record that fails is skipped, so the buffer holds `null` in its place and the run
  // keeps writing the ones behind it in input order.
  const buffered = new Map<number, string | null>();
  let written = 0;
  const flush = (): void => {
    while (buffered.has(written)) {
      const line = buffered.get(written) ?? null;
      buffered.delete(written);
      written += 1;
      if (line !== null) writeLine(deps.stdout, line);
    }
  };

  // Anything but a per-Record `JudgeError` ends the run; the rest of the calls are aborted
  // rather than left to finish into a report nobody will read.
  const controller = new AbortController();
  const signal = deps.signal
    ? AbortSignal.any([deps.signal, controller.signal])
    : controller.signal;
  let fatal: unknown;

  let drifted = false;
  let failed = false;
  let taken = 0;
  let done = 0;

  const worker = async (): Promise<void> => {
    while (fatal === undefined) {
      const index = taken;
      const record = records[index];
      if (record === undefined) return;
      taken += 1;

      try {
        // Sequential on purpose: `width` of these loops run side by side, and awaiting one
        // Record at a time is what keeps the gate from being widened behind the flag.
        // oxlint-disable-next-line no-await-in-loop
        const decision = await judge(record, recipe, { signal });
        if (!drifted && decision.model !== recipe.model) {
          drifted = true;
          writeLine(deps.stderr, `siftline: ${driftMessage(recipe.model, decision.model)}`);
        }
        buffered.set(
          index,
          serializeDecision(rules === null ? decision : routeDecision(decision, rules)),
        );
      } catch (error) {
        if (!(error instanceof JudgeError)) {
          fatal ??= error;
          controller.abort(error);
          return;
        }
        failed = true;
        writeLine(deps.stderr, `${record.id}: ${sentence(error)}`);
        buffered.set(index, null);
      }

      done += 1;
      progress.tick(done);
      flush();
    }
  };

  const width = Math.min(maxInFlight, records.length);
  await Promise.all(Array.from({ length: width }, () => worker()));
  progress.finish();

  if (fatal !== undefined) throw fatal;
  return failed ? 1 : 0;
}

const REASONS: {
  readonly [R in Exclude<JudgeErrorReason, "invalid_answers" | "unknown">]: string;
} = {
  max_tokens_exceeded: "state over the token budget",
  api_usage_error: "the API refused the request",
  network: "the call never reached the API",
  timeout: "the call timed out",
};

function sentence(error: JudgeError): string {
  if (error.reason === "unknown") return error.message;
  if (error.reason === "invalid_answers") {
    return `the answers did not fit the Recipe: ${error.message}`;
  }
  return REASONS[error.reason];
}

/** One line per this many Records where the counter cannot be rewritten in place. */
const PROGRESS_EVERY = 50;

interface Progress {
  tick: (done: number) => void;
  finish: () => void;
}

const SILENT: Progress = { tick: () => undefined, finish: () => undefined };

function createProgress(stream: OutputStream, total: number, quiet: boolean): Progress {
  if (quiet || total === 0) return SILENT;

  if (stream.isTTY === true) {
    return {
      tick: (done) => {
        stream.write(`\r${done}/${total}`);
      },
      finish: () => {
        stream.write("\n");
      },
    };
  }

  return {
    tick: (done) => {
      if (done % PROGRESS_EVERY === 0) writeLine(stream, `${done}/${total}`);
    },
    finish: () => undefined,
  };
}
