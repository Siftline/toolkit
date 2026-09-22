import { parseArgs } from "node:util";
import type { ParseArgsOptionsConfig } from "node:util";

import { DEFAULT_MAX_IN_FLIGHT } from "@siftline/core";

import type { RunDeps } from "./deps";
import { UsageError } from "./deps";

export const API_KEY_ENV = "TYPESAFE_API_KEY";

export interface TestOptions {
  maxInFlight: number;
  minAccuracy: number | null;
  json: boolean;
  quiet: boolean;
}

export interface LabelOptions {
  maxInFlight: number;
  quiet: boolean;
  rules: string | null;
}

/** Each command hands `parseArgs` only its own flags, so a foreign one is an unknown option. */
const TEST_FLAGS = {
  "max-in-flight": { type: "string" },
  "min-accuracy": { type: "string" },
  json: { type: "boolean" },
  quiet: { type: "boolean" },
} as const;

const LABEL_FLAGS = {
  "max-in-flight": { type: "string" },
  quiet: { type: "boolean" },
  rules: { type: "string" },
} as const;

/** What a command's parser hands back: its positionals and its typed options. */
export interface ParsedArgs<O> {
  positionals: string[];
  options: O;
}

export function parseTestArgs(args: readonly string[]): ParsedArgs<TestOptions> {
  const { values, positionals } = parseWith(args, TEST_FLAGS);

  return {
    positionals,
    options: {
      maxInFlight: gateWidth(values["max-in-flight"]),
      minAccuracy: ratio(values["min-accuracy"]),
      json: values.json === true,
      quiet: values.quiet === true,
    },
  };
}

export function parseLabelArgs(args: readonly string[]): ParsedArgs<LabelOptions> {
  const { values, positionals } = parseWith(args, LABEL_FLAGS);

  return {
    positionals,
    options: {
      maxInFlight: gateWidth(values["max-in-flight"]),
      quiet: values.quiet === true,
      rules: values.rules ?? null,
    },
  };
}

function parseWith<const F extends ParseArgsOptionsConfig>(args: readonly string[], flags: F) {
  try {
    return parseArgs({ args: [...args], options: flags, allowPositionals: true, strict: true });
  } catch (cause) {
    throw new UsageError(firstSentence(cause), { cause });
  }
}

/** The key is read here and nowhere else, so it never reaches argv, usage or a log line. */
export function requireApiKey(env: RunDeps["env"]): void {
  const key = env[API_KEY_ENV];

  if (key === undefined || key.trim() === "") {
    throw new UsageError(`${API_KEY_ENV} is not set`);
  }
}

function gateWidth(raw: string | undefined): number {
  if (raw === undefined) return DEFAULT_MAX_IN_FLIGHT;
  const value = parseNumber(raw);

  if (value === undefined || !Number.isInteger(value) || value < 1) {
    throw new UsageError(
      `--max-in-flight takes an integer of 1 or more, not ${JSON.stringify(raw)}`,
    );
  }

  return value;
}

function ratio(raw: string | undefined): number | null {
  if (raw === undefined) return null;
  const value = parseNumber(raw);

  if (value === undefined || value < 0 || value > 1) {
    throw new UsageError(`--min-accuracy takes a ratio from 0 to 1, not ${JSON.stringify(raw)}`);
  }

  return value;
}

function parseNumber(raw: string): number | undefined {
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
