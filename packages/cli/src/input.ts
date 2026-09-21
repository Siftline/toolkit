import { readFile } from "node:fs/promises";

import {
  parseFixtures,
  parseRecipe,
  ruleSchema,
  validateFixtures,
  validateRules,
} from "@siftline/core";
import type { EntryType, Fixture, Recipe, Record, Rule } from "@siftline/core";

import type { InputStream } from "./deps";
import { InputError } from "./deps";

export async function readTextFile(path: string, what: string): Promise<string> {
  try {
    return await readFile(path, "utf8");
  } catch (cause) {
    throw new InputError(`cannot read the ${what} ${path}: ${reason(cause)}`, { cause });
  }
}

export async function readRecipeFile(path: string): Promise<Recipe> {
  const text = await readTextFile(path, "recipe");
  try {
    return parseRecipe(text);
  } catch (cause) {
    throw new InputError(`${path} is not a valid Recipe: ${reason(cause)}`, { cause });
  }
}

export async function readFixturesFile(path: string, recipe: Recipe): Promise<Fixture[]> {
  return await readChecked(path, "fixtures", "Fixtures", parseFixtures, (fixtures) =>
    validateFixtures(fixtures, recipe).map(
      (problem) => `fixture ${problem.fixture}: ${problem.problem}`,
    ),
  );
}

export async function readRulesFile(path: string, recipe: Recipe): Promise<Rule[]> {
  return await readChecked(
    path,
    "rules",
    "Rules",
    (text) => ruleSchema.array().parse(JSON.parse(text)),
    (rules) =>
      validateRules(rules, recipe).map((problem) => `rule ${problem.rule}: ${problem.problem}`),
  );
}

/** Parse the whole file, then refuse it on the first line that no longer fits the Recipe. */
async function readChecked<T>(
  path: string,
  what: string,
  kind: string,
  parse: (text: string) => T[],
  stale: (items: T[]) => string[],
): Promise<T[]> {
  const text = await readTextFile(path, what);

  let items: T[];
  try {
    items = parse(text);
  } catch (cause) {
    throw new InputError(`${path} does not hold valid ${kind}: ${reason(cause)}`, { cause });
  }

  const problems = stale(items);
  const first = problems[0];
  if (first) {
    throw new InputError(`${path} does not fit the Recipe: ${first}${andMore(problems.length)}`);
  }

  return items;
}

/** `-` and an absent path both mean stdin. Every line is parsed before the caller judges any. */
export async function readRecords(path: string | undefined, stdin: InputStream): Promise<Record[]> {
  const fromStdin = path === undefined || path === "-";
  const source = fromStdin ? "stdin" : path;
  const text = fromStdin ? await readStdin(stdin) : await readTextFile(path, "records");

  const records: Record[] = [];
  for (const [offset, line] of text.split("\n").entries()) {
    if (line.trim() === "") continue;
    try {
      records.push(parseRecord(line));
    } catch (cause) {
      throw new InputError(`${source} line ${offset + 1} is not a valid Record: ${reason(cause)}`, {
        cause,
      });
    }
  }

  return records;
}

async function readStdin(stream: InputStream): Promise<string> {
  const decoder = new TextDecoder();
  let text = "";
  for await (const chunk of stream) {
    text += typeof chunk === "string" ? chunk : decoder.decode(chunk, { stream: true });
  }
  return text + decoder.decode();
}

const RECORD_KEYS = new Set(["id", "state", "trimmed"]);

// Hand-rolled because core publishes no Record schema and the CLI carries no validator of
// its own. Strict: an unknown key is a bad line, not a field to ignore.
function parseRecord(line: string): Record {
  const value: unknown = JSON.parse(line);
  if (!isObject(value)) throw new Error("a Record is a JSON object");

  for (const key of Object.keys(value)) {
    if (!RECORD_KEYS.has(key)) throw new Error(`unknown key ${JSON.stringify(key)}`);
  }

  const { id, state, trimmed } = value;
  if (typeof id !== "string" || id === "") throw new Error("id is a non-empty string");
  if (!isEntry(state)) throw new Error("state is prose, a JSON object, a JSON array or null");
  if (trimmed !== undefined && typeof trimmed !== "boolean")
    throw new Error("trimmed is a boolean");

  return trimmed === undefined ? { id, state } : { id, state, trimmed };
}

function isObject(value: unknown): value is { [key: string]: unknown } {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// The line came through `JSON.parse`, so anything of type `object` is already a `JsonValue`.
function isEntry(value: unknown): value is EntryType {
  return value === null || typeof value === "string" || typeof value === "object";
}

interface Issue {
  path: readonly PropertyKey[];
  message: string;
}

/** Zod's issues by duck typing: the CLI states no opinion on the validator core uses. */
function issuesOf(value: unknown): Issue[] | undefined {
  if (typeof value !== "object" || value === null || !("issues" in value)) return undefined;
  const raw: unknown = value.issues;
  if (!Array.isArray(raw)) return undefined;

  const issues: Issue[] = [];
  for (const candidate of raw) if (isIssue(candidate)) issues.push(candidate);
  return issues.length === 0 ? undefined : issues;
}

function isIssue(value: unknown): value is Issue {
  return (
    typeof value === "object" &&
    value !== null &&
    "message" in value &&
    typeof value.message === "string" &&
    "path" in value &&
    Array.isArray(value.path)
  );
}

function reason(cause: unknown): string {
  const issues = issuesOf(cause);
  if (issues) return describe(issues);

  if (cause instanceof Error) {
    const nested = issuesOf(cause.cause);
    return nested ? `${cause.message}: ${describe(nested)}` : cause.message;
  }

  return String(cause);
}

function describe(issues: readonly Issue[]): string {
  const first = issues[0];
  if (!first) return "invalid";
  const where = first.path.length === 0 ? "" : `${first.path.join(".")}: `;
  return `${where}${first.message}${andMore(issues.length)}`;
}

/** The tail every "here is the first of them" sentence in this file ends with. */
function andMore(count: number): string {
  return count === 1 ? "" : ` (and ${count - 1} more)`;
}
