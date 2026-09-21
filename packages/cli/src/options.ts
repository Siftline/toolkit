import { parseArgs } from "node:util";

import { DEFAULT_MAX_IN_FLIGHT } from "@siftline/core";

import type { RunDeps } from "./deps";
import { UsageError } from "./deps";

export const API_KEY_ENV = "TYPESAFE_API_KEY";

/** Every option both commands accept. Each command refuses the ones it has no use for. */
export interface CommandOptions {
  maxInFlight: number;
  minAccuracy: number | null;
  json: boolean;
  quiet: boolean;
  rules: string | null;
}

export interface CommandArgs {
  positionals: string[];
  options: CommandOptions;
}

const FLAGS = {
  "max-in-flight": { type: "string" },
  "min-accuracy": { type: "string" },
  json: { type: "boolean" },
  quiet: { type: "boolean" },
  rules: { type: "string" },
} as const;

export function parseCommandArgs(args: readonly string[]): CommandArgs {
  let values: { [name: string]: string | boolean | undefined };
  let positionals: string[];

  try {
    ({ values, positionals } = parseArgs({
      args: [...args],
      options: FLAGS,
      allowPositionals: true,
      strict: true,
    }));
  } catch (cause) {
    throw new UsageError(firstSentence(cause), { cause });
  }

  return {
    positionals,
    options: {
      maxInFlight: gateWidth(text(values["max-in-flight"])),
      minAccuracy: ratio(text(values["min-accuracy"])),
      json: values["json"] === true,
      quiet: values["quiet"] === true,
      rules: text(values["rules"]) ?? null,
    },
  };
}

/** The key is read here and nowhere else, so it never reaches argv, usage or a log line. */
export function requireApiKey(env: RunDeps["env"]): void {
  const key = env[API_KEY_ENV];
  if (key === undefined || key.trim() === "") {
    throw new UsageError(`${API_KEY_ENV} is not set`);
  }
}

function text(value: string | boolean | undefined): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function gateWidth(raw: string | undefined): number {
  if (raw === undefined) return DEFAULT_MAX_IN_FLIGHT;
  const value = number(raw);
  if (value === undefined || !Number.isInteger(value) || value < 1) {
    throw new UsageError(
      `--max-in-flight takes an integer of 1 or more, not ${JSON.stringify(raw)}`,
    );
  }
  return value;
}

function ratio(raw: string | undefined): number | null {
  if (raw === undefined) return null;
  const value = number(raw);
  if (value === undefined || value < 0 || value > 1) {
    throw new UsageError(`--min-accuracy takes a ratio from 0 to 1, not ${JSON.stringify(raw)}`);
  }
  return value;
}

function number(raw: string): number | undefined {
  if (raw.trim() === "") return undefined;
  const value = Number(raw);
  return Number.isFinite(value) ? value : undefined;
}

// `parseArgs` appends a paragraph on `--` to its unknown-option message; the first sentence
// is the part a usage block does not already say.
function firstSentence(cause: unknown): string {
  const message = cause instanceof Error ? cause.message : String(cause);
  return message.split(". ")[0] ?? message;
}
